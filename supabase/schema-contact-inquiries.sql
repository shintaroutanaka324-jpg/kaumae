-- お問い合わせ（schema.sql / is_admin 関数実行後に実行）

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

create index if not exists contact_inquiries_status_idx on public.contact_inquiries (status);
create index if not exists contact_inquiries_created_at_idx on public.contact_inquiries (created_at desc);

alter table public.contact_inquiries enable row level security;

-- フォームからの投稿（未ログイン含む）
create policy "contact_inquiries_insert_public"
  on public.contact_inquiries for insert
  with check (true);

-- 運営のみ閲覧・更新
create policy "contact_inquiries_select_admin"
  on public.contact_inquiries for select
  using (public.is_admin());

create policy "contact_inquiries_update_admin"
  on public.contact_inquiries for update
  using (public.is_admin());

grant select, insert, update on public.contact_inquiries to anon, authenticated;
