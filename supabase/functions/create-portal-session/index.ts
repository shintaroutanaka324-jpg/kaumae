import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { normalizeSiteBase, sanitizeSiteRedirectUrl } from "../_shared/safe-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLACEHOLDER_PATTERN = /YOUR_|placeholder|sk_test_REPLACE|price_REPLACE/i;

function isPlaceholder(value: string | undefined | null) {
  if (!value) return true;
  return PLACEHOLDER_PATTERN.test(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (isPlaceholder(stripeSecret) || isPlaceholder(serviceRoleKey)) {
      return new Response(
        JSON.stringify({
          error: "Stripe is not configured yet",
          demo: true,
          message: "Supabase Secrets に STRIPE_SECRET_KEY を設定してください",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "ログインが必要です" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "認証に失敗しました" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const base = normalizeSiteBase(body.siteUrl);
    const returnUrl = sanitizeSiteRedirectUrl(
      body.returnUrl,
      `${base}account-settings.html?billing=return`
    );

    const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id, is_paid, is_paid_member")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const stripe = new Stripe(stripeSecret!, { apiVersion: "2023-10-16" });

    let customerId = profile?.stripe_customer_id || "";

    if (!customerId && profile?.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
      customerId = String(subscription.customer || "");
      if (customerId) {
        await supabaseAdmin
          .from("profiles")
          .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({
          error: "サブスクリプションが見つかりません。先に有料プランへご登録ください。",
          code: "no_subscription",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[create-portal-session]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Portal creation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
