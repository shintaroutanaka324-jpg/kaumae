-- ログイン失敗回数によるアカウント一時ロック（5回失敗で24時間ロック）
-- schema.sql 実行後に Supabase SQL Editor で実行してください

create table if not exists public.login_lockouts (
  email text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_lockouts enable row level security;

create or replace function public.get_login_lockout_status(check_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  norm_email text := lower(trim(check_email));
  max_attempts constant integer := 5;
  lock_row public.login_lockouts;
begin
  if norm_email is null or norm_email = '' then
    return jsonb_build_object(
      'locked', false,
      'failed_attempts', 0,
      'attempts_remaining', max_attempts,
      'locked_until', null
    );
  end if;

  select * into lock_row
  from public.login_lockouts
  where email = norm_email;

  if not found then
    return jsonb_build_object(
      'locked', false,
      'failed_attempts', 0,
      'attempts_remaining', max_attempts,
      'locked_until', null
    );
  end if;

  if lock_row.locked_until is not null and lock_row.locked_until <= now() then
    update public.login_lockouts
    set failed_attempts = 0,
        locked_until = null,
        updated_at = now()
    where email = norm_email;

    return jsonb_build_object(
      'locked', false,
      'failed_attempts', 0,
      'attempts_remaining', max_attempts,
      'locked_until', null
    );
  end if;

  if lock_row.locked_until is not null and lock_row.locked_until > now() then
    return jsonb_build_object(
      'locked', true,
      'failed_attempts', lock_row.failed_attempts,
      'attempts_remaining', 0,
      'locked_until', lock_row.locked_until
    );
  end if;

  return jsonb_build_object(
    'locked', false,
    'failed_attempts', lock_row.failed_attempts,
    'attempts_remaining', greatest(0, max_attempts - lock_row.failed_attempts),
    'locked_until', null
  );
end;
$$;

create or replace function public.record_login_failure(check_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  norm_email text := lower(trim(check_email));
  max_attempts constant integer := 5;
  lock_hours constant integer := 24;
  lock_row public.login_lockouts;
  next_attempts integer;
  next_locked_until timestamptz;
begin
  if norm_email is null or norm_email = '' then
    return public.get_login_lockout_status(check_email);
  end if;

  perform public.get_login_lockout_status(check_email);

  insert into public.login_lockouts (email, failed_attempts, locked_until, updated_at)
  values (norm_email, 0, null, now())
  on conflict (email) do nothing;

  select * into lock_row
  from public.login_lockouts
  where email = norm_email
  for update;

  next_attempts := lock_row.failed_attempts + 1;
  next_locked_until := null;

  if next_attempts >= max_attempts then
    next_attempts := max_attempts;
    next_locked_until := now() + make_interval(hours => lock_hours);
  end if;

  update public.login_lockouts
  set failed_attempts = next_attempts,
      locked_until = next_locked_until,
      updated_at = now()
  where email = norm_email;

  return public.get_login_lockout_status(check_email);
end;
$$;

create or replace function public.clear_login_lockout(check_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  norm_email text := lower(trim(check_email));
begin
  if norm_email is null or norm_email = '' then
    return;
  end if;

  delete from public.login_lockouts
  where email = norm_email;
end;
$$;

revoke all on function public.get_login_lockout_status(text) from public;
revoke all on function public.record_login_failure(text) from public;
revoke all on function public.clear_login_lockout(text) from public;

grant execute on function public.get_login_lockout_status(text) to anon, authenticated;
grant execute on function public.record_login_failure(text) to anon, authenticated;
grant execute on function public.clear_login_lockout(text) to anon, authenticated;

revoke all on table public.login_lockouts from anon, authenticated;
grant select, insert, update, delete on table public.login_lockouts to service_role;
