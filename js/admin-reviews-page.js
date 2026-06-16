document.addEventListener("DOMContentLoaded", async () => {
  const app = document.getElementById("admin-app");
  if (!app) return;

  try {
    await App.whenReady();

    if (!Auth.isConfigured()) {
      app.innerHTML = `<div class="adm-empty-state" style="padding:4rem">Supabase の設定を完了してください。</div>`;
      return;
    }

    if (!Auth.isLoggedIn()) {
      window.location.href = "login.html?redirect=admin.html";
      return;
    }

    await Auth.ensureProfile?.();

    if (!Auth.isAdmin()) {
      app.innerHTML = `<div class="adm-empty-state" style="padding:4rem">運営者権限が必要です。<br>Supabase の <code>profiles</code> テーブルで <code>is_admin = true</code> が設定されているか確認してください。<br><a href="index.html">トップへ</a></div>`;
      return;
    }

    const contentRoot = await AdminShell.mount(app, {
      active: "reviews",
      pageTitle: "口コミ管理",
      pageSubtitle: "投稿口コミの審査・公開・編集",
      searchPlaceholder: "サービス名・投稿者・本文で検索...",
      onSearch: (q) => AdminReviews.setSearchQuery(q),
    });

    await ProductsApi.whenReady?.();
    await ReviewsApi.whenReady?.();

    const initialTab = App.getQueryParam("tab") || "all";
    const initialReview = App.getQueryParam("review");
    const validTabs = ["all", "pending", "read_unlock", "approved", "hidden", "rejected"];

    await AdminReviews.render(contentRoot, {
      tab: validTabs.includes(initialTab) ? initialTab : "all",
      reviewId: initialReview || null,
    });
  } catch (err) {
    console.error("[カウマエ] 口コミ管理", err);
    app.innerHTML = `<div class="adm-empty-state">${App.escapeHtml(err.message || "読み込みに失敗しました")}</div>`;
  }
});
