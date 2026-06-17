(function () {
  const TYPE_LABELS = {
    defamation: "名誉毀損",
    privacy: "プライバシー侵害",
    copyright: "著作権侵害",
    trademark: "商標権侵害",
    "personal-info": "個人情報掲載",
    "false-info": "虚偽情報",
    other: "その他法令違反",
  };

  const STATUS_LABELS = {
    new: "未対応",
    in_progress: "対応中",
    resolved: "完了",
    rejected: "却下",
  };

  function getClient() {
    return window.Auth?.getClient?.() ?? null;
  }

  function ensureConfigured() {
    if (!window.Auth?.isConfigured?.()) {
      throw new Error("削除依頼機能の設定が完了していません。");
    }
    const client = getClient();
    if (!client) throw new Error("接続の準備ができていません。ページを再読み込みしてください。");
    return client;
  }

  function getTypeLabel(value) {
    return TYPE_LABELS[value] || value || "—";
  }

  function getStatusLabel(value) {
    return STATUS_LABELS[value] || value || "—";
  }

  function isSafeHttpsUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return url.protocol === "https:" && Boolean(url.hostname);
    } catch {
      return false;
    }
  }

  function formatRateLimitError(error) {
    const msg = error?.message || "";
    if (msg.includes("rate_limit_exceeded") || msg.includes("rate_limit")) {
      return "送信回数が上限に達しました。1時間ほど待ってから再度お試しください。";
    }
    return msg || "送信に失敗しました";
  }

  async function submitDeletionRequest({ name, email, targetUrl, requestType, message }) {
    const client = ensureConfigured();
    const payload = {
      name: String(name || "").trim(),
      email: String(email || "").trim(),
      target_url: String(targetUrl || "").trim(),
      request_type: requestType,
      message: String(message || "").trim(),
    };

    if (!payload.name) throw new Error("氏名または法人名を入力してください");
    if (!payload.email) throw new Error("メールアドレスを入力してください");
    if (!payload.target_url) throw new Error("対象ページURLを入力してください");
    if (!isSafeHttpsUrl(payload.target_url)) {
      throw new Error("対象ページURLは https:// で始まる有効なURLを入力してください");
    }
    if (!payload.request_type) throw new Error("依頼種別を選択してください");
    if (!payload.message) throw new Error("問題となる箇所・削除を求める理由を入力してください");

    const { error } = await client.from("deletion_requests").insert(payload);
    if (error) throw new Error(formatRateLimitError(error));
  }

  async function fetchDeletionRequests({ limit = 200, status } = {}) {
    if (!window.Auth?.isAdmin?.()) {
      throw new Error("運営者権限が必要です");
    }
    const client = ensureConfigured();
    let query = client.from("deletion_requests").select("*").order("created_at", { ascending: false }).limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message || "削除依頼の取得に失敗しました");
    return data || [];
  }

  async function updateDeletionRequestStatus(id, status, adminNote) {
    if (!window.Auth?.isAdmin?.()) {
      throw new Error("運営者権限が必要です");
    }
    const client = ensureConfigured();
    const payload = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (adminNote !== undefined) {
      payload.admin_note = String(adminNote || "").trim() || null;
    }

    const { error } = await client.from("deletion_requests").update(payload).eq("id", id);
    if (error) throw new Error(error.message || "更新に失敗しました");
  }

  async function countNewDeletionRequests() {
    if (!window.Auth?.isAdmin?.()) return 0;
    try {
      const client = ensureConfigured();
      const { count, error } = await client
        .from("deletion_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "new");
      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  window.DeletionRequestApi = {
    TYPE_LABELS,
    STATUS_LABELS,
    getTypeLabel,
    getStatusLabel,
    submitDeletionRequest,
    fetchDeletionRequests,
    updateDeletionRequestStatus,
    countNewDeletionRequests,
  };
})();
