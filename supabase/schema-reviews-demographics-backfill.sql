-- 既存口コミへプロフィールの年代・性別を反映（未設定の口コミのみ）
-- schema-profile-demographics.sql 実行後に SQL Editor から実行してください

update public.submitted_reviews r
set
  reviewer_age_group = coalesce(nullif(r.reviewer_age_group, ''), p.age_group),
  reviewer_gender = coalesce(nullif(r.reviewer_gender, ''), p.gender)
from public.profiles p
where r.user_id = p.id
  and (
    r.reviewer_age_group is null
    or r.reviewer_age_group = ''
    or r.reviewer_gender is null
    or r.reviewer_gender = ''
  )
  and (
    (p.age_group is not null and p.age_group <> '')
    or (p.gender is not null and p.gender <> '')
  );
