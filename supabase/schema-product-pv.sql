-- サービス詳細ページ PV 集計（schema-products.sql 実行後）
-- SQL Editor で実行してください

create table if not exists public.product_pv_daily (
  product_id text not null references public.products (id) on delete cascade,
  view_date date not null,
  view_count integer not null default 0 check (view_count >= 0),
  primary key (product_id, view_date)
);

create index if not exists product_pv_daily_date_idx on public.product_pv_daily (view_date desc);

alter table public.product_pv_daily enable row level security;

-- 運営のみ集計データを閲覧
drop policy if exists "product_pv_daily_select_admin" on public.product_pv_daily;
create policy "product_pv_daily_select_admin"
  on public.product_pv_daily for select
  using (
    coalesce((select is_admin from public.profiles where id = auth.uid()), false) = true
  );

-- 公開中サービスの PV を日次で加算（直接 insert は不可）
create or replace function public.record_product_page_view(p_product_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (timezone('Asia/Tokyo', now()))::date;
begin
  if p_product_id is null or length(trim(p_product_id)) = 0 then
    return;
  end if;

  if not exists (
    select 1 from public.products
    where id = p_product_id and is_published = true
  ) then
    return;
  end if;

  insert into public.product_pv_daily (product_id, view_date, view_count)
  values (p_product_id, v_date, 1)
  on conflict (product_id, view_date)
  do update set view_count = public.product_pv_daily.view_count + 1;
end;
$$;

revoke all on function public.record_product_page_view(text) from public;
grant execute on function public.record_product_page_view(text) to anon, authenticated;
