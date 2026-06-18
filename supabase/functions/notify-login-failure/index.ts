import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_HOURS = 24;
const RECENT_FAILURE_WINDOW_MS = 5 * 60 * 1000;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatJaDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildEmailHtml(params: {
  email: string;
  failedAttempts: number;
  locked: boolean;
  lockedUntil: string | null;
  siteUrl: string;
}) {
  const forgotUrl = `${params.siteUrl.replace(/\/$/, "")}/forgot-password.html`;
  const lockLine = params.locked
    ? `<p style="color:#b91c1c;font-weight:bold;">ログイン試行が${MAX_ATTEMPTS}回に達したため、アカウントは${LOCKOUT_HOURS}時間ロックされています。${
        params.lockedUntil ? `${formatJaDateTime(params.lockedUntil)}（日本時間）以降に再度お試しください。` : ""
      }</p>`
    : `<p>あと${Math.max(0, MAX_ATTEMPTS - params.failedAttempts)}回失敗すると、${LOCKOUT_HOURS}時間ログインがロックされます。</p>`;

  return `
    <div style="font-family:sans-serif;line-height:1.7;color:#1e293b;max-width:560px;">
      <p>カウマエをご利用いただきありがとうございます。</p>
      <p>お客様のアカウント（${params.email}）で、ログインに失敗しました。</p>
      <p>現在の失敗回数: <strong>${params.failedAttempts}回</strong></p>
      ${lockLine}
      <p>心当たりがない場合は、第三者による不正アクセスの可能性があります。パスワードの変更をご検討ください。</p>
      <p><a href="${forgotUrl}">パスワードを再設定する</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
      <p style="font-size:12px;color:#64748b;">このメールはログイン失敗時に自動送信されています。ご本人による操作の場合は、パスワードをご確認のうえ再度ログインしてください。</p>
    </div>
  `.trim();
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM") || "カウマエ <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("[notify-login-failure] RESEND_API_KEY is not set");
    return { ok: false, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("[notify-login-failure] Resend error", response.status, detail);
    return { ok: false, error: detail };
  }

  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "サーバー設定が不完全です" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: registered, error: registeredError } = await admin.rpc("is_email_registered", {
      check_email: email,
    });

    if (registeredError || registered !== true) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lockout, error: lockoutError } = await admin.rpc("get_login_lockout_status", {
      check_email: email,
    });

    if (lockoutError || !lockout || Number(lockout.failed_attempts || 0) < 1) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lockRow } = await admin
      .from("login_lockouts")
      .select("updated_at")
      .eq("email", email)
      .maybeSingle();

    const updatedAt = lockRow?.updated_at ? new Date(lockRow.updated_at).getTime() : 0;
    if (!updatedAt || Date.now() - updatedAt > RECENT_FAILURE_WINDOW_MS) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const failedAttempts = Number(lockout.failed_attempts || 0);
    const locked = lockout.locked === true;
    const lockedUntil = lockout.locked_until ? String(lockout.locked_until) : null;
    const siteUrl = Deno.env.get("SITE_URL") || "https://www.kaumae-info.com/";

    const subject = locked
      ? "【カウマエ】ログイン失敗によりアカウントをロックしました"
      : "【カウマエ】ログインに失敗しました";

    const html = buildEmailHtml({
      email,
      failedAttempts,
      locked,
      lockedUntil,
      siteUrl,
    });

    const sendResult = await sendViaResend({ to: email, subject, html });

    return new Response(JSON.stringify({ ok: sendResult.ok, skipped: sendResult.skipped === true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[notify-login-failure]", error);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
