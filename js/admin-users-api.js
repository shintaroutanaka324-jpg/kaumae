(function () {
  const PROFILE_COLUMNS =
    "id, display_name, email, is_admin, is_paid, is_paid_member, has_posted_review, stripe_customer_id, stripe_subscription_id, subscription_status, age_group, gender, created_at, updated_at";

  function getClient() {
    const client = window.Auth?.getClient?.();
    if (!client) throw new Error("接続の準備ができていません。");
    return client;
  }

  function ensureAdmin() {
    if (!window.Auth?.isAdmin?.()) throw new Error("運営者権限が必要です。");
  }

  async function getAccessToken() {
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.access_token) {
      throw new Error("ログインが必要です。");
    }
    return data.session.access_token;
  }

  async function loadProfilesAdmin() {
    ensureAdmin();
    const { data, error } = await getClient()
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async function loadWithdrawnUsersAdmin() {
    if (window.AccountApi?.loadWithdrawnUsersAdmin) {
      return window.AccountApi.loadWithdrawnUsersAdmin();
    }
    ensureAdmin();
    const { data, error } = await getClient()
      .from("withdrawn_users")
      .select("*")
      .order("withdrawn_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async function loadWithdrawalAuditLogsAdmin() {
    if (window.AccountApi?.loadWithdrawalAuditLogsAdmin) {
      return window.AccountApi.loadWithdrawalAuditLogsAdmin();
    }
    ensureAdmin();
    const { data, error } = await getClient()
      .from("withdrawal_audit_logs")
      .select("*")
      .order("withdrawn_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    return data || [];
  }

  async function callAdminBilling({ action, userId, atPeriodEnd, returnUrl }) {
    ensureAdmin();
    const config = window.SUPABASE_CONFIG || {};
    const baseUrl = config.url?.replace(/\/$/, "");
    if (!baseUrl || !config.anonKey) {
      throw new Error("Supabase の設定が完了していません。");
    }

    const token = await getAccessToken();
    const siteBase =
      typeof window.Auth?.getSiteBaseUrl === "function"
        ? window.Auth.getSiteBaseUrl()
        : `${window.location.origin}/`;

    const response = await fetch(`${baseUrl}/functions/v1/admin-billing`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        userId,
        atPeriodEnd,
        siteUrl: siteBase,
        returnUrl: returnUrl || `${siteBase}admin-users.html?tab=subscriptions`,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || payload.message || "管理操作に失敗しました");
    }
    return payload;
  }

  function subscriptionStatusLabel(status) {
    if (window.BillingApi?.getSubscriptionStatusLabel) {
      return window.BillingApi.getSubscriptionStatusLabel(status) || "未加入";
    }
    return status || "未加入";
  }

  function isActiveSubscription(profile) {
    const status = String(profile?.subscription_status || "").toLowerCase();
    if (status === "active" || status === "trialing" || status === "past_due") return true;
    return Boolean(profile?.is_paid || profile?.is_paid_member);
  }

  window.AdminUsersApi = {
    loadProfilesAdmin,
    loadWithdrawnUsersAdmin,
    loadWithdrawalAuditLogsAdmin,
    callAdminBilling,
    subscriptionStatusLabel,
    isActiveSubscription,
  };
})();
