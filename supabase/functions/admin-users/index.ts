import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const verified = await verifyAdmin(req.headers.get("Authorization"));
    if ("error" in verified && verified.error) return verified.error;

    const { supabaseAdmin, adminUser } = verified;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const userId = String(body.userId || "");

    if (!userId) {
      return jsonResponse({ error: "userId が必要です" }, 400);
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, is_admin")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) {
      return jsonResponse({ error: "ユーザーが見つかりません" }, 404);
    }

    if (action === "setAdmin") {
      const isAdmin = body.isAdmin === true;

      if (!isAdmin) {
        const { count, error: countError } = await supabaseAdmin
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("is_admin", true);

        if (countError) throw countError;

        if ((count || 0) <= 1 && target.is_admin) {
          return jsonResponse({ error: "最後の運営者の権限は解除できません" }, 400);
        }

        if (userId === adminUser.id && target.is_admin) {
          return jsonResponse(
            { error: "自分自身の運営権限は解除できません。別の運営者に依頼してください" },
            400
          );
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          is_admin: isAdmin,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      return jsonResponse({
        ok: true,
        message: isAdmin ? "運営権限を付与しました" : "運営権限を解除しました",
        profile: { id: userId, is_admin: isAdmin },
      });
    }

    return jsonResponse({ error: "不明な action です" }, 400);
  } catch (err) {
    console.error("[admin-users]", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "処理に失敗しました" },
      500
    );
  }
});
