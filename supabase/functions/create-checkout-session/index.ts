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
    const priceId = Deno.env.get("STRIPE_PRICE_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (isPlaceholder(stripeSecret) || isPlaceholder(priceId)) {
      return new Response(
        JSON.stringify({
          error: "Stripe is not configured yet",
          demo: true,
          message: "Supabase Secrets に STRIPE_SECRET_KEY と STRIPE_PRICE_ID を設定してください",
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

    const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "認証に失敗しました" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const base = normalizeSiteBase(body.siteUrl);
    const successUrl = sanitizeSiteRedirectUrl(body.successUrl, `${base}?payment=success`);
    const cancelUrl = sanitizeSiteRedirectUrl(body.cancelUrl, `${base}?payment=cancel`);

    const supabaseAdmin = !isPlaceholder(serviceRoleKey)
      ? createClient(supabaseUrl!, serviceRoleKey!)
      : null;
    let existingCustomerId: string | null = null;
    if (supabaseAdmin) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();
      existingCustomerId = profile?.stripe_customer_id || null;
    }

    const stripe = new Stripe(stripeSecret!, { apiVersion: "2023-10-16" });

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId!, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
    };

    if (existingCustomerId) {
      sessionParams.customer = existingCustomerId;
    } else if (user.email) {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[create-checkout-session]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Checkout creation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
