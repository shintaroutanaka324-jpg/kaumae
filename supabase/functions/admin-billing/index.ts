import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { normalizeSiteBase, sanitizeSiteRedirectUrl } from "../_shared/safe-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLACEHOLDER_PATTERN = /YOUR_|placeholder|sk_test_REPLACE/i;

function isPlaceholder(value: string | undefined | null) {
  if (!value) return true;
  return PLACEHOLDER_PATTERN.test(value);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyAdmin(authHeader: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authHeader) {
    return { error: jsonResponse({ error: "ログインが必要です" }, 401) };
  }

  const supabaseAuth = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!);

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError || !user) {
    return { error: jsonResponse({ error: "認証に失敗しました" }, 401) };
  }

  const { data: adminProfile, error: adminError } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (adminError || !adminProfile?.is_admin) {
    return { error: jsonResponse({ error: "運営者権限が必要です" }, 403) };
  }

  return { supabaseAdmin, adminUser: user };
}

function paidFromStatus(status: string) {
  return status === "active" || status === "trialing";
}

async function updateProfileFromSubscription(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  subscription: Stripe.Subscription
) {
  const status = subscription.status;
  const isPaid = paidFromStatus(status);

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      is_paid: isPaid,
      is_paid_member: isPaid,
      stripe_customer_id: String(subscription.customer || ""),
      stripe_subscription_id: subscription.id,
      subscription_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw error;

  return {
    subscription_status: status,
    is_paid: isPaid,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: String(subscription.customer || ""),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const verified = await verifyAdmin(req.headers.get("Authorization"));
    if ("error" in verified && verified.error) return verified.error;

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (isPlaceholder(stripeSecret)) {
      return jsonResponse(
        {
          error: "Stripe is not configured yet",
          demo: true,
          message: "Supabase Secrets に STRIPE_SECRET_KEY を設定してください",
        },
        503
      );
    }

    const { supabaseAdmin } = verified;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const userId = String(body.userId || "");

    if (!userId) {
      return jsonResponse({ error: "userId が必要です" }, 400);
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, email, display_name, stripe_customer_id, stripe_subscription_id, subscription_status, is_paid, is_paid_member"
      )
      .eq("id", userId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) {
      return jsonResponse({ error: "ユーザーが見つかりません" }, 404);
    }

    const stripe = new Stripe(stripeSecret!, { apiVersion: "2023-10-16" });

    if (action === "sync") {
      let subscription: Stripe.Subscription | null = null;

      if (target.stripe_subscription_id) {
        subscription = await stripe.subscriptions.retrieve(target.stripe_subscription_id);
      } else if (target.stripe_customer_id) {
        const list = await stripe.subscriptions.list({
          customer: target.stripe_customer_id,
          status: "all",
          limit: 1,
        });
        subscription = list.data[0] || null;
      }

      if (!subscription) {
        await supabaseAdmin
          .from("profiles")
          .update({
            is_paid: false,
            is_paid_member: false,
            subscription_status: target.subscription_status || "none",
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        return jsonResponse({
          ok: true,
          message: "Stripe 上に有効なサブスクリプションは見つかりませんでした",
          profile: {
            subscription_status: target.subscription_status || "none",
            is_paid: false,
          },
        });
      }

      const updated = await updateProfileFromSubscription(supabaseAdmin, userId, subscription);
      return jsonResponse({ ok: true, message: "Stripe から同期しました", profile: updated });
    }

    if (action === "cancel") {
      if (!target.stripe_subscription_id) {
        return jsonResponse({ error: "サブスクリプション ID がありません" }, 400);
      }

      const atPeriodEnd = body.atPeriodEnd !== false;
      let subscription: Stripe.Subscription;

      if (atPeriodEnd) {
        subscription = await stripe.subscriptions.update(target.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      } else {
        subscription = await stripe.subscriptions.cancel(target.stripe_subscription_id);
      }

      const updated = await updateProfileFromSubscription(supabaseAdmin, userId, subscription);
      return jsonResponse({
        ok: true,
        message: atPeriodEnd ? "期間終了時に解約するよう設定しました" : "サブスクリプションを解約しました",
        profile: updated,
      });
    }

    if (action === "portal") {
      let customerId = target.stripe_customer_id || "";

      if (!customerId && target.stripe_subscription_id) {
        const subscription = await stripe.subscriptions.retrieve(target.stripe_subscription_id);
        customerId = String(subscription.customer || "");
      }

      if (!customerId) {
        return jsonResponse({ error: "Stripe 顧客 ID がありません" }, 400);
      }

      const base = normalizeSiteBase(body.siteUrl);
      const returnUrl = sanitizeSiteRedirectUrl(
        body.returnUrl,
        `${base}admin-users.html?tab=subscriptions`
      );

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return jsonResponse({ ok: true, url: session.url });
    }

    if (action === "revoke") {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          is_paid: false,
          is_paid_member: false,
          subscription_status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;
      return jsonResponse({ ok: true, message: "有料フラグを解除しました（Stripe 側は別途確認してください）" });
    }

    return jsonResponse({ error: "不明な action です" }, 400);
  } catch (err) {
    console.error("[admin-billing]", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "処理に失敗しました" },
      500
    );
  }
});
