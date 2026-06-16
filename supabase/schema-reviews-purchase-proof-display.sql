-- 口コミ: 運営による購入証明の公開表示設定
-- submitted_reviews 作成済みの環境で SQL Editor から実行してください

alter table public.submitted_reviews
  add column if not exists show_purchase_proof boolean;

comment on column public.submitted_reviews.show_purchase_proof is
  '運営が設定する購入証明の公開表示（true=あり、false=なし、null=従来どおりファイル有無に従う）';

-- 既存データ: ファイル提出済みは「あり」、未提出は「なし」
update public.submitted_reviews
set show_purchase_proof = (purchase_proof_path is not null and purchase_proof_path <> '')
where show_purchase_proof is null;
