/**
 * セキュリティ監査（匿名キー + 管理API未認証）
 * 実行: node scripts/security-audit.mjs
 */

const SUPABASE_URL = "https://pzqkfknrzvrqrfdemetq.supabase.co";
const ANON_KEY = "sb_publishable_MLj2s3NRvUAqis--XvQenQ_YAjys8j_";
const SITE = "https://www.kaumae-info.com";

const anonHeaders = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

const results = [];

function record(category, label, pass, detail = "") {
  results.push({ category, label, pass, detail });
  const mark = pass ? "OK" : "NG";
  console.log(`[${mark}] [${category}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function rest(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { ...anonHeaders, ...(opts.headers || {}) },
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

async function callFunction(name, body = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function fetchSiteJs(path) {
  const res = await fetch(`${SITE}/${path}`);
  return res.ok ? res.text() : "";
}

async function checkFrontendSecrets() {
  console.log("\n=== フロントエンド（本番 JS） ===");
  const patterns = [
    /service_role/i,
    /sb_secret/i,
    /sk_live_[a-zA-Z0-9]+/,
    /sk_test_[a-zA-Z0-9]{10,}/,
    /whsec_[a-zA-Z0-9]{10,}/,
    /SUPABASE_SERVICE_ROLE/i,
    /STRIPE_SECRET/i,
  ];

  const files = [
    "js/supabase-config.js",
    "js/auth.js",
    "js/billing-api.js",
    "js/admin-users-api.js",
    "js/reviews-api.js",
    "js/review-detail.js",
  ];

  for (const file of files) {
    const content = await fetchSiteJs(file);
    const hits = patterns.filter((p) => p.test(content));
    record(
      "frontend",
      `${file} に秘密キーなし`,
      hits.length === 0,
      hits.length ? hits.map((p) => p.toString()).join(", ") : "publishable anon key のみ"
    );
  }
}

async function checkAnonymousDbAccess() {
  console.log("\n=== DB（匿名キー・RLS） ===");

  const checks = [
    {
      label: "profiles（email / 課金情報）",
      path: "profiles?select=id,email,stripe_customer_id,stripe_subscription_id,is_admin&limit=10",
      leak: (rows) => rows.some((r) => r?.email || r?.stripe_customer_id),
    },
    {
      label: "withdrawn_users（退会メール）",
      path: "withdrawn_users?select=email&limit=10",
      leak: (rows) => rows.length > 0,
    },
    {
      label: "withdrawal_audit_logs",
      path: "withdrawal_audit_logs?select=user_id,reason&limit=10",
      leak: (rows) => rows.length > 0,
    },
    {
      label: "contact_inquiries（問い合わせ）",
      path: "contact_inquiries?select=email,message&limit=10",
      leak: (rows) => rows.length > 0,
    },
    {
      label: "deletion_requests（削除依頼）",
      path: "deletion_requests?select=email,message&limit=10",
      leak: (rows) => rows.length > 0,
    },
    {
      label: "submitted_reviews 全文（body_pros）",
      path: "submitted_reviews?select=id,body_pros,body_cons,admin_note&status=eq.approved&limit=10",
      leak: (rows) => rows.some((r) => r?.body_pros || r?.body_cons || r?.admin_note),
    },
    {
      label: "approved_reviews_preview（プレビューのみ）",
      path: "approved_reviews_preview?select=id,body_preview&limit=3",
      leak: () => false,
      expectOk: true,
    },
  ];

  for (const c of checks) {
    const { res, data } = await rest(c.path);
    const rows = Array.isArray(data) ? data : [];
    const leaked = c.leak(rows);
    if (c.expectOk) {
      record("db", c.label, res.ok && rows.length > 0, res.ok ? `${rows.length} rows` : `status ${res.status}`);
    } else {
      record("db", c.label, !leaked, leaked ? `leaked ${rows.length} rows` : `blocked/empty (${res.status})`);
    }
  }
}

async function checkAdminFunctions() {
  console.log("\n=== Edge Functions（未認証拒否） ===");

  for (const name of ["admin-users", "admin-billing"]) {
    const { res, data } = await callFunction(name, {
      action: "setAdmin",
      userId: "00000000-0000-0000-0000-000000000001",
    });
    const blocked = res.status === 401 || res.status === 403;
    record(
      "edge",
      `${name} は未認証を拒否`,
      blocked,
      `status=${res.status} ${data.error || data.message || ""}`
    );
  }

  const checkout = await callFunction("create-checkout-session", {});
  record(
    "edge",
    "create-checkout-session は未認証を拒否",
    checkout.res.status === 401,
    `status=${checkout.res.status} ${checkout.data?.error || ""}`
  );
}

async function main() {
  console.log("カウマエ セキュリティ監査\n");
  await checkFrontendSecrets();
  await checkAnonymousDbAccess();
  await checkAdminFunctions();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n結果: ${results.length - failed.length}/${results.length} OK`);
  if (failed.length) {
    console.log("\n要対応:");
    failed.forEach((f) => console.log(` - [${f.category}] ${f.label}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
