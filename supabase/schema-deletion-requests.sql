-- 削除依頼（schema.sql / is_admin 関数実行後に実行）

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 1),
  email text not null check (char_length(trim(email)) >= 3),
  target_url text not null check (char_length(trim(target_url)) >= 8),
  request_type text not null check (
    request_type in (
      'defamation',
      'privacy',
      'copyright',
      'trademark',
      'personal-info',
      'false-info',
      'other'
    )
  ),
  message text not null check (char_length(trim(message)) >= 1),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'resolved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deletion_requests_status_idx on public.deletion_requests (status);
create index if not exists deletion_requests_created_at_idx on public.deletion_requests (created_at desc);

alter table public.deletion_requests enable row level security;

create policy "deletion_requests_insert_public"
  on public.deletion_requests for insert
  with check (true);

create policy "deletion_requests_select_admin"
  on public.deletion_requests for select
  using (public.is_admin());

create policy "deletion_requests_update_admin"
  on public.deletion_requests for update
  using (public.is_admin());

grant select, insert, update on public.deletion_requests to anon, authenticated;
