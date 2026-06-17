/**
 * デプロイ後の確認スクリプト（匿名 + 公開 API）
 * 実行: node scripts/verify-post-deploy.mjs
 */

const SUPABASE_URL = "https://pzqkfknrzvrqrfdemetq.supabase.co";
const ANON_KEY = "sb_publishable_MLj2s3NRvUAqis--XvQenQ_YAjys8j_";
const SITE = "https://www.kaumae-info.com";

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

function ok(label, pass, detail = "") {
  const mark = pass ? "OK" : "NG";
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

async function rest(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { ...headers, ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data, text };
}

async function checkFunction(name) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "OPTIONS",
  });
  return res.status < 500;
}

async function checkSiteAssets() {
  console.log("\n=== 1. 本番フロント（GitHub Pages） ===");
  const html = await fetch(`${SITE}/admin-users.html`).then((r) => r.text());
  ok(
    "admin-users.html に最新 JS 参照",
    html.includes("admin-users.js?v=20260618adminrole"),
    html.includes("admin-users.js") ? "script tag found" : "missing"
  );
  ok("admin-deletion-requests.html が存在", (await fetch(`${SITE}/admin-deletion-requests.html`)).ok);
  const js = await fetch(`${SITE}/js/admin-users.js`).then((r) => r.text());
  ok("admin-users.js に運営トグル", js.includes("toggle-admin"));
  ok("admin-users.js にプラン列", js.includes("プラン"));
}

async function checkEdgeFunctions() {
  console.log("\n=== 2. Edge Functions（到達確認） ===");
  for (const name of [
    "admin-users",
    "admin-billing",
    "withdraw-account",
    "create-checkout-session",
    "create-portal-session",
  ]) {
    const reachable = await checkFunction(name);
    ok(`functions/v1/${name}`, reachable, reachable ? "OPTIONS ok" : "unreachable");
  }
}

async function checkSecuritySchema() {
  console.log("\n=== 3. DB セキュリティ（匿名キー） ===");

  const preview = await rest(
    "approved_reviews_preview?select=id,body_preview&limit=3"
  );
  ok(
    "approved_reviews_preview view",
    preview.res.ok,
    preview.res.ok ? `${(preview.data || []).length} rows` : preview.text?.slice?.(0, 120) || preview.res.status
  );

  const full = await rest(
    "submitted_reviews?select=id,body_pros,admin_note&status=eq.approved&limit=3"
  );
  const fullRows = Array.isArray(full.data) ? full.data : [];
  const leaked = fullRows.some((r) => r?.body_pros || r?.admin_note);
  ok(
    "承認済み口コミ全文（匿名は取得不可）",
    !full.res.ok || fullRows.length === 0 || !leaked,
    full.res.ok ? `rows=${fullRows.length}` : `blocked (${full.res.status})`
  );

  const profiles = await rest("profiles?select=id,email,is_admin&limit=5");
  const profileRows = Array.isArray(profiles.data) ? profiles.data : [];
  ok(
    "profiles 全件公開が閉じている",
    profileRows.length === 0,
    profileRows.length ? `leaked ${profileRows.length} rows` : "0 rows"
  );

  const del = await rest("deletion_requests?select=id&limit=1");
  ok(
    "deletion_requests 管理者のみ閲覧",
    !del.res.ok || (Array.isArray(del.data) && del.data.length === 0),
    del.res.status === 200 ? "anon can read (NG)" : `status ${del.res.status}`
  );
}

async function checkPublicSite() {
  console.log("\n=== 4. 公開ページ ===");
  ok("トップページ", (await fetch(SITE)).ok);
  ok("口コミ一覧", (await fetch(`${SITE}/reviews.html`)).ok);
  ok("削除依頼フォーム", (await fetch(`${SITE}/deletion-request.html`)).ok);
}

async function main() {
  console.log("カウマエ デプロイ後確認\n");
  await checkSiteAssets();
  await checkEdgeFunctions();
  await checkSecuritySchema();
  await checkPublicSite();
  console.log("\n完了。NG があれば該当項目を確認してください。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
