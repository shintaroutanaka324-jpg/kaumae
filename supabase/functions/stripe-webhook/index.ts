import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const PLACEHOLDER_PATTERN = /YOUR_|placeholder|whsec_REPLACE/i;

function isPlaceholder(value: string | undefined | null) {
  if (!value) return true;
  return PLACEHOLDER_PATTERN.test(value);
}

async function setPaidStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  payload: Record<string, unknown>
) {
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}

serve(async (req) => {
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (isPlaceholder(stripeSecret) || isPlaceholder(webhookSecret) || isPlaceholder(serviceRoleKey)) {
    return new Response("Stripe webhook not configured", { status: 503 });
  }

  const stripe = new Stripe(stripeSecret!, { apiVersion: "2023-10-16" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret!);
  } catch (err) {
    console.error("[stripe-webhook] signature error", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createClient(supabaseUrl!, serviceRoleKey!);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id || session.client_reference_id;
        if (!userId) break;

        await setPaidStatus(supabase, userId, {
          is_paid: true,
          is_paid_member: true,
          stripe_customer_id: String(session.customer || ""),
          stripe_subscription_id: String(session.subscription || ""),
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        });
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        let userId = subscription.metadata?.supabase_user_id;

        if (!userId) {
          const { data: profileBySub } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_subscription_id", subscription.id)
            .maybeSingle();
          userId = profileBySub?.id;
        }

        if (!userId) break;

        const isPaid = subscription.status === "active" || subscription.status === "trialing";

        await setPaidStatus(supabase, userId, {
          is_paid: isPaid,
          is_paid_member: isPaid,
          stripe_customer_id: String(subscription.customer || ""),
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          updated_at: new Date().toISOString(),
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (!userId) break;

        await setPaidStatus(supabase, userId, {
          is_paid: false,
          is_paid_member: false,
          subscription_status: "canceled",
          updated_at: new Date().toISOString(),
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) break;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_subscription_id", String(subscriptionId))
          .maybeSingle();

        if (profile?.id) {
          await setPaidStatus(supabase, profile.id, {
            subscription_status: "past_due",
            updated_at: new Date().toISOString(),
          });
        }
        break;
      }
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-webhook] handler error", err);
    return new Response("Webhook handler failed", { status: 500 });
  }
});
