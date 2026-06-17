(function () {
  const SUBJECT_LABELS = {
    general: "一般的なお問い合わせ",
    review: "口コミに関するお問い合わせ",
    account: "アカウントに関するお問い合わせ",
    report: "不適切な投稿の報告",
    other: "その他",
  };

  const STATUS_LABELS = {
    new: "未対応",
    in_progress: "対応中",
    resolved: "完了",
  };

  function getClient() {
    return window.Auth?.getClient?.() ?? null;
  }

  function ensureConfigured() {
    if (!window.Auth?.isConfigured?.()) {
      throw new Error("お問い合わせ機能の設定が完了していません。");
    }
    const client = getClient();
    if (!client) throw new Error("接続の準備ができていません。ページを再読み込みしてください。");
    return client;
  }

  function getSubjectLabel(value) {
    return SUBJECT_LABELS[value] || value || "—";
  }

  function getStatusLabel(value) {
    return STATUS_LABELS[value] || value || "—";
  }

  function formatRateLimitError(error) {
    const msg = error?.message || "";
    if (msg.includes("rate_limit_exceeded") || msg.includes("rate_limit")) {
      return "送信回数が上限に達しました。1時間ほど待ってから再度お試しください。";
    }
    return msg || "送信に失敗しました";
  }

  async function submitInquiry({ name, email, subject, message }) {
    const client = ensureConfigured();
    const payload = {
      name: String(name || "").trim(),
      email: String(email || "").trim(),
      subject,
      message: String(message || "").trim(),
    };

    if (!payload.name) throw new Error("お名前を入力してください");
    if (!payload.email) throw new Error("メールアドレスを入力してください");
    if (!payload.subject) throw new Error("件名を選択してください");
    if (!payload.message) throw new Error("お問い合わせ内容を入力してください");

    const { error } = await client.from("contact_inquiries").insert(payload);
    if (error) throw new Error(formatRateLimitError(error));
  }

  async function fetchInquiries({ limit = 100 } = {}) {
    if (!window.Auth?.isAdmin?.()) {
      throw new Error("運営者権限が必要です");
    }
    const client = ensureConfigured();
    const { data, error } = await client
      .from("contact_inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message || "お問い合わせの取得に失敗しました");
    return data || [];
  }

  async function updateInquiryStatus(id, status, adminNote) {
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

    const { error } = await client.from("contact_inquiries").update(payload).eq("id", id);
    if (error) throw new Error(error.message || "更新に失敗しました");
  }

  window.ContactApi = {
    SUBJECT_LABELS,
    STATUS_LABELS,
    getSubjectLabel,
    getStatusLabel,
    submitInquiry,
    fetchInquiries,
    updateInquiryStatus,
  };
})();
