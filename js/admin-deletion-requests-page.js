document.addEventListener("DOMContentLoaded", async () => {
  const app = document.getElementById("admin-app");
  if (!app) return;

  try {
    await App.whenReady();

    if (!Auth.isConfigured()) {
      app.innerHTML =
        '<div class="adm-empty-state" style="padding:4rem">Supabase の設定を完了してください。</div>';
      return;
    }

    if (!Auth.isLoggedIn()) {
      window.location.href = "login.html?redirect=admin-deletion-requests.html";
      return;
    }

    await Auth.ensureProfile?.();

    if (!Auth.isAdmin()) {
      app.innerHTML =
        '<div class="adm-empty-state" style="padding:4rem">運営者権限が必要です。<br>Supabase の <code>profiles</code> テーブルで <code>is_admin = true</code> が設定されているか確認してください。</div>';
      return;
    }

    const root = await AdminShell.mount(app, {
      active: "deletions",
      pageTitle: "削除依頼管理",
      pageSubtitle: "権利侵害・削除依頼の確認と対応",
    });

    root.innerHTML = `
      <section class="adm-panel adm-panel--full" aria-labelledby="adm-deletion-title">
        <div class="adm-panel-head">
          <h2 class="adm-panel-title" id="adm-deletion-title">削除依頼</h2>
          <span class="adm-inquiries-badge" id="adm-deletion-new-count">—</span>
        </div>
        <div class="adm-panel-body" id="adm-deletion-root"></div>
      </section>`;

    await AdminDeletionRequests.mount(document.getElementById("adm-deletion-root"));
  } catch (err) {
    console.error("[カウマエ] 削除依頼管理", err);
    app.innerHTML = `<div class="adm-empty-state" style="padding:4rem">${App.escapeHtml(err.message || "読み込みに失敗しました")}</div>`;
  }
});
