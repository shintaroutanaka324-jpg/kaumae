# Supabase 認証セットアップ

カウマエの新規登録・ログインは Supabase Auth でユーザー情報を管理します。

## 1. Supabase プロジェクトを作成

1. [Supabase](https://supabase.com) にログイン
2. **New project** でプロジェクトを作成

## 2. データベースを準備

1. Dashboard → **SQL Editor**
2. `supabase/schema.sql` の内容を貼り付けて **Run**

## 3. 接続情報を設定

1. Dashboard → **Settings** → **API**
2. **Project URL** と **anon public** key をコピー
3. `js/supabase-config.js` の `url` と `anonKey` に貼り付け

```javascript
window.SUPABASE_CONFIG = {
  url: "https://xxxxxxxx.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  siteBasePath: "/",
};
```

> anon key はフロントエンドに公開されるキーです。Row Level Security で保護されています。

## 3b. 独自ドメイン（kaumae-info.com）

本番 URL は **https://www.kaumae-info.com/** です。ルート（`kaumae-info.com`）も DNS 設定で同じサイトに向けます。

### お名前.com の DNS 設定

| 種類 | ホスト名 | 値 |
|------|----------|-----|
| CNAME | `www` | `shintaroutanaka324-jpg.github.io` |
| A | `@`（空） | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

反映まで数時間かかることがあります。

### GitHub Pages

1. リポジトリ **Settings → Pages → Custom domain** に `www.kaumae-info.com` を入力
2. DNS 確認後 **Enforce HTTPS** を ON
3. リポジトリ直下の `CNAME` ファイル（`www.kaumae-info.com`）がデプロイされていることを確認

GitHub が apex（`kaumae-info.com`）から www へのリダイレクトを自動設定します。

## 4. 認証設定（推奨）

Dashboard → **Authentication** → **Providers** → **Email**

| 設定 | 開発時 | 本番時 |
|------|--------|--------|
| Confirm email | OFF（すぐログイン可能） | ON（メール確認を推奨） |
| Secure email change | ON | ON |

### URL Configuration（重要）

Dashboard → **Authentication** → **URL Configuration**

**Site URL**（末尾スラッシュ付き・`/index` は付けない）:

```
https://www.kaumae-info.com/
```

**Redirect URLs** に以下をすべて追加:

```
https://www.kaumae-info.com/**
https://www.kaumae-info.com/auth-callback.html
https://www.kaumae-info.com/reset-password.html
https://kaumae-info.com/**
https://kaumae-info.com/auth-callback.html
https://kaumae-info.com/reset-password.html
https://shintaroutanaka324-jpg.github.io/kaumae/**
```

ローカル開発時は例:

```
http://localhost:5500/**
http://localhost:5500/kaumae/**
```

> 旧リポジトリ名（`kuchikomi_sampl` など）の Redirect URL は Supabase から削除して構いません。

メール確認リンクは `auth-callback.html` に戻り、そこでログイン状態になります。

## 5. メール重複チェック（新規登録）

SQL Editor で `supabase/schema-email-check.sql` を実行してください。  
登録済みメールで新規登録しようとしたときに、正しくエラーを表示できます。

## 5b. ログイン失敗ロック（5回で24時間ロック）

SQL Editor で `supabase/schema-login-lockout.sql` を実行してください。  
同一メールアドレスでパスワードを5回連続で間違えると、24時間ログインがロックされます。ログイン成功時、またはパスワード変更成功時にロックは解除されます。

### ログイン失敗通知メール

Edge Function `notify-login-failure` をデプロイし、Secrets に以下を設定してください。

| Secret | 説明 |
|--------|------|
| `RESEND_API_KEY` | [Resend](https://resend.com) の API キー |
| `MAIL_FROM` | 送信元（例: `カウマエ <noreply@kaumae-info.com>`） |
| `SITE_URL` | サイトURL（例: `https://www.kaumae-info.com/`） |

登録済みメールアドレスでパスワード入力に失敗するたび、本人宛に通知メールが送信されます。`RESEND_API_KEY` 未設定時はログイン処理は継続し、メールのみスキップされます。

## 6. サービス管理のセットアップ

1. SQL Editor で `supabase/schema-products.sql` を実行
2. 続けて `supabase/schema-products-public-registry.sql` も実行（**非公開サービスを公開サイトから隠す場合に必須**）
3. 続けて `supabase/schema-products-images.sql` も実行（**サービス画像のアップロードに必須**）

## 7. 口コミ投稿・審査のセットアップ

1. SQL Editor で `supabase/schema-reviews.sql` を実行
2. 続けて `supabase/schema-reviews-fields.sql` も実行（口コミ項目の追加）
3. 続けて `supabase/schema-reviews-admin-edit.sql` も実行（運営による口コミ修正の記録。**公開・編集で必須**）
4. 続けて `supabase/schema-reviews-hidden.sql` も実行（口コミの非表示機能。**運営がサイトから隠す場合に必須**）
5. 続けて `supabase/schema-reviews-read-unlock.sql` も実行（ルールベースの全文閲覧解除。**口コミ投稿時のモザイク解除に必須**）
6. 続けて `supabase/schema-reviews-submit-fields.sql` も実行（サービス名・販売者名の分離、返金保証項目。**口コミ投稿フォーム更新後に必須**）
7. **Storage** → `purchase-proofs` バケットが作成されていることを確認

### 運営者アカウントの設定

SQL Editor で、運営担当者のメールアドレスに管理者権限を付与します。

```sql
update public.profiles
set is_admin = true
where email = 'あなたの運営用メール@example.com';
```

運営者でログイン後、ヘッダーメニューから **口コミ審査（運営）** → `/admin.html`（運営ダッシュボード内）にアクセスできます。

## 8. Stripe 課金（月額880円）

口コミ全文閲覧の有料プランは `supabase/STRIPE-SETUP.md` を参照してください。  
先に `schema-stripe.sql` を SQL Editor で実行してください。

## 9. 動作確認

### ユーザー登録

1. サイトを開き **新規登録** でアカウント作成
2. Supabase Dashboard → **Authentication** → **Users** にユーザーが表示されること
3. **Table Editor** → `profiles` にユーザー名・メールが保存されること
4. ログアウト後、同じメール・パスワードで **ログイン** できること

### 口コミ投稿フロー

1. ログイン後 **口コミを投稿** から内容を送信
2. `submitted_reviews` テーブルに `status = pending` で保存されること
3. 内容がルールベース品質チェックを通過した場合、`read_unlock_status = auto_approved` となり他口コミの全文閲覧が即時解除されること
4. 品質チェックに引っかかった場合、`read_unlock_status = pending` のままモザイクが維持され、運営が **閲覧解除待ち** タブから承認できること
5. 購入証明を添付した場合、`purchase-proofs` ストレージにファイルが保存されること
6. **投稿した口コミ** ページで公開審査・閲覧解除の状態が表示されること
7. 運営者が **口コミ審査** で「承認して公開」
8. `status = approved` になり、紐づけたサービス詳細ページに口コミが表示されること

## 保存される情報

| 場所 | 内容 |
|------|------|
| `auth.users`（Supabase管理） | メール、ハッシュ化されたパスワード |
| `public.profiles` | ユーザーID、表示名、メール、運営者フラグ |
| `public.submitted_reviews` | 口コミ本文・評価・審査ステータス |
| `storage.purchase-proofs` | 購入証明ファイル（非公開） |

パスワードは平文では保存されません。口コミは **運営承認後** にのみ公開されます。
