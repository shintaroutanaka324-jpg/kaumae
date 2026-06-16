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
      window.location.href = "login.html?redirect=admin-services.html";
      return;
    }

    await Auth.ensureProfile?.();

    if (!Auth.isAdmin()) {
      app.innerHTML = `<div class="adm-empty-state" style="padding:4rem">運営者権限が必要です。<br>Supabase の <code>profiles</code> テーブルで <code>is_admin = true</code> が設定されているか確認してください。<br><a href="index.html">トップへ</a></div>`;
      return;
    }

    const contentRoot = await AdminShell.mount(app, {
      active: "services",
      pageTitle: "登録管理",
      pageSubtitle: "登録内容の監視・編集・公開設定",
      searchPlaceholder: "提供者・講師・カテゴリで検索...",
      onSearch: (q) => AdminProducts.setSearchQuery(q),
    });

    await ReviewsApi.whenReady?.();
    await AdminProducts.render(contentRoot);
  } catch (err) {
    console.error("[カウマエ] サービス管理", err);
    app.innerHTML = `<div class="adm-empty-state">${App.escapeHtml(err.message || "読み込みに失敗しました")}</div>`;
  }
});
