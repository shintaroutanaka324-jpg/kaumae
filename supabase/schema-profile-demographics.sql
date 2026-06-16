-- カウマエ: プロフィール・口コミへの年代・性別
-- profiles / submitted_reviews 作成済みの環境で SQL Editor から実行してください

alter table public.profiles
  add column if not exists age_group text,
  add column if not exists gender text;

alter table public.submitted_reviews
  add column if not exists reviewer_age_group text,
  add column if not exists reviewer_gender text;

comment on column public.profiles.age_group is '年代（例: 20代）';
comment on column public.profiles.gender is '性別（男性/女性/その他/回答しない）';
comment on column public.submitted_reviews.reviewer_age_group is '投稿時点の年代スナップショット';
comment on column public.submitted_reviews.reviewer_gender is '投稿時点の性別スナップショット';

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
