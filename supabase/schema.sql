-- カウマエ: ユーザープロフィール（Supabase Auth と連携）
-- Supabase Dashboard → SQL Editor で実行してください

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  email text not null,
  is_paid_member boolean not null default false,
  is_paid boolean not null default false,
  has_posted_review boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  age_group text,
  gender text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_public"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- 新規登録時にプロフィールを自動作成
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, age_group, gender)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data ->> 'age_group'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'gender'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
