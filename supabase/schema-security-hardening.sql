-- カウマエ: セキュリティ強化（一括適用・再実行可）
-- 最低限 schema.sql + schema-reviews.sql が実行済みであること。
-- 不足テーブル・列はこのファイル内で補完します。
-- Supabase Dashboard → SQL Editor で実行してください。

-- =============================================================================
-- 0. 前提の補完（不足分を自動追加）
-- =============================================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_paid boolean not null default false,
  add column if not exists is_paid_member boolean not null default false,
  add column if not exists has_posted_review boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

alter table public.submitted_reviews
  add column if not exists is_published boolean not null default true,
  add column if not exists read_unlock_status text not null default 'pending',
  add column if not exists reviewer_age_group text,
  add column if not exists reviewer_gender text;

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 1),
  email text not null check (char_length(trim(email)) >= 3),
  subject text not null check (subject in ('general', 'review', 'account', 'report', 'other')),
  message text not null check (char_length(trim(message)) >= 1),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'resolved')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_inquiries enable row level security;

drop policy if exists "contact_inquiries_insert_public" on public.contact_inquiries;
create policy "contact_inquiries_insert_public"
  on public.contact_inquiries for insert
  with check (true);

drop policy if exists "contact_inquiries_select_admin" on public.contact_inquiries;
create policy "contact_inquiries_select_admin"
  on public.contact_inquiries for select
  using (public.is_admin());

drop policy if exists "contact_inquiries_update_admin" on public.contact_inquiries;
create policy "contact_inquiries_update_admin"
  on public.contact_inquiries for update
  using (public.is_admin());

grant select, insert, update on public.contact_inquiries to anon, authenticated;

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 1),
  email text not null check (char_length(trim(email)) >= 3),
  target_url text not null check (char_length(trim(target_url)) >= 8),
  request_type text not null check (
    request_type in (
      'defamation', 'privacy', 'copyright', 'trademark',
      'personal-info', 'false-info', 'other'
    )
  ),
  message text not null check (char_length(trim(message)) >= 1),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'resolved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deletion_requests enable row level security;

drop policy if exists "deletion_requests_insert_public" on public.deletion_requests;
create policy "deletion_requests_insert_public"
  on public.deletion_requests for insert
  with check (true);

drop policy if exists "deletion_requests_select_admin" on public.deletion_requests;
create policy "deletion_requests_select_admin"
  on public.deletion_requests for select
  using (public.is_admin());

drop policy if exists "deletion_requests_update_admin" on public.deletion_requests;
create policy "deletion_requests_update_admin"
  on public.deletion_requests for update
  using (public.is_admin());

grant select, insert, update on public.deletion_requests to anon, authenticated;

-- =============================================================================
-- 1. profiles: is_admin 保護 + SELECT 限定
-- =============================================================================

create or replace function public.protect_billing_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and auth.uid() = old.id then
    new.is_paid := old.is_paid;
    new.is_paid_member := old.is_paid_member;
    new.has_posted_review := old.has_posted_review;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.subscription_status := old.subscription_status;
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profiles_billing on public.profiles;
create trigger protect_profiles_billing
  before update on public.profiles
  for each row execute function public.protect_billing_fields();

drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

-- =============================================================================
-- 2. submitted_reviews: 全文は有料/投稿者/運営のみ、匿名はプレビュー view
-- =============================================================================

create or replace function public.can_read_full_reviews()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.is_admin() then true
    else coalesce(
      (
        select (p.is_paid or p.is_paid_member or p.has_posted_review)
        from public.profiles p
        where p.id = auth.uid()
      ),
      false
    )
  end;
$$;

drop policy if exists "submitted_reviews_select_approved" on public.submitted_reviews;
drop policy if exists "submitted_reviews_select_approved_full" on public.submitted_reviews;

create policy "submitted_reviews_select_approved_full"
  on public.submitted_reviews for select
  using (
    status = 'approved'
    and coalesce(is_published, true) = true
    and public.can_read_full_reviews()
  );

drop view if exists public.approved_reviews_preview cascade;

create view public.approved_reviews_preview as
select
  id,
  product_id,
  product_name,
  purchase_price,
  purchase_year,
  purchase_month,
  cost_performance,
  recommendation,
  support_quality,
  content_satisfaction,
  result_realization,
  reviewer_display_name,
  reviewer_age_group,
  reviewer_gender,
  published_at,
  created_at,
  left(coalesce(body_pros, ''), 200) as body_preview
from public.submitted_reviews
where status = 'approved'
  and coalesce(is_published, true) = true;

grant select on public.approved_reviews_preview to anon, authenticated;

-- =============================================================================
-- 3. read_unlock_status: 一般ユーザーは pending 固定（自己承認防止）
-- =============================================================================

create or replace function public.enforce_read_unlock_on_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    NEW.read_unlock_status := 'pending';
  elsif TG_OP = 'UPDATE' then
    if NEW.read_unlock_status is distinct from OLD.read_unlock_status then
      NEW.read_unlock_status := OLD.read_unlock_status;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_read_unlock_before_write on public.submitted_reviews;
create trigger enforce_read_unlock_before_write
  before insert or update on public.submitted_reviews
  for each row execute function public.enforce_read_unlock_on_write();

-- =============================================================================
-- 4. process_account_withdrawal: service_role のみ実行可
-- =============================================================================

create or replace function public.process_account_withdrawal(
  p_user_id uuid,
  p_email text,
  p_reason text,
  p_reason_other text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_audit_id uuid;
  v_review_count integer;
  v_proof_paths text[];
  v_deleted_count integer := 0;
  v_proof_result text;
  v_path text;
  v_role text;
begin
  v_role := coalesce(auth.jwt() ->> 'role', '');

  if v_role is distinct from 'service_role' then
    raise exception 'not authorized';
  end if;

  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  insert into public.withdrawal_audit_logs (user_id, reason, reason_other, result)
  values (p_user_id, p_reason, nullif(trim(p_reason_other), ''), 'processing')
  returning id into v_audit_id;

  select count(*)::integer
  into v_review_count
  from public.submitted_reviews
  where user_id = p_user_id;

  select coalesce(array_agg(purchase_proof_path), '{}')
  into v_proof_paths
  from public.submitted_reviews
  where user_id = p_user_id
    and purchase_proof_path is not null
    and purchase_proof_path <> '';

  foreach v_path in array v_proof_paths
  loop
    begin
      delete from storage.objects
      where bucket_id = 'purchase-proofs'
        and name = v_path;
      v_deleted_count := v_deleted_count + 1;
    exception when others then
      null;
    end;
  end loop;

  update public.submitted_reviews
  set purchase_proof_path = null,
      updated_at = now()
  where user_id = p_user_id;

  v_proof_result := format('deleted:%s,paths:%s', v_deleted_count, coalesce(array_length(v_proof_paths, 1), 0));

  insert into public.withdrawn_users (
    user_id, email, reason, reason_other, review_count, purchase_proof_deleted
  ) values (
    p_user_id,
    lower(trim(p_email)),
    p_reason,
    nullif(trim(p_reason_other), ''),
    v_review_count,
    true
  );

  update public.withdrawal_audit_logs
  set result = 'success',
      purchase_proof_deletion_result = v_proof_result
  where id = v_audit_id;

  return jsonb_build_object(
    'ok', true,
    'audit_id', v_audit_id,
    'review_count', v_review_count,
    'purchase_proof_deletion_result', v_proof_result
  );
exception when others then
  update public.withdrawal_audit_logs
  set result = 'failed',
      error_message = sqlerrm
  where id = v_audit_id;
  raise;
end;
$$;

revoke all on function public.process_account_withdrawal(uuid, text, text, text) from public;
grant execute on function public.process_account_withdrawal(uuid, text, text, text) to service_role;

-- =============================================================================
-- 5. 公開フォームのレート制限（同一メール 1時間に5件まで）
-- =============================================================================

create or replace function public.enforce_contact_inquiry_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.contact_inquiries
  where lower(trim(email)) = lower(trim(NEW.email))
    and created_at > now() - interval '1 hour';

  if v_count >= 5 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists contact_inquiries_rate_limit on public.contact_inquiries;
create trigger contact_inquiries_rate_limit
  before insert on public.contact_inquiries
  for each row execute function public.enforce_contact_inquiry_rate_limit();

create or replace function public.enforce_deletion_request_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.deletion_requests
  where lower(trim(email)) = lower(trim(NEW.email))
    and created_at > now() - interval '1 hour';

  if v_count >= 5 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists deletion_requests_rate_limit on public.deletion_requests;
create trigger deletion_requests_rate_limit
  before insert on public.deletion_requests
  for each row execute function public.enforce_deletion_request_rate_limit();

-- =============================================================================
-- 6. 非公開商品の匿名閲覧ポリシーを削除
-- =============================================================================

do $$
begin
  if to_regclass('public.products') is not null then
    drop policy if exists "products_select_unpublished" on public.products;
  end if;
end $$;
