document.addEventListener("DOMContentLoaded", async () => {
  const app = document.getElementById("admin-app");
  if (!app) return;

  try {
    await App.whenReady();

    if (!Auth.isLoggedIn()) {
      window.location.href = "login.html?redirect=admin-inquiries.html";
      return;
    }

    await Auth.ensureProfile?.();

    if (!Auth.isAdmin()) {
      app.innerHTML =
        '<div class="adm-empty-state" style="padding:4rem">運営者権限が必要です。<br>Supabase の <code>profiles</code> テーブルで <code>is_admin = true</code> が設定されているか確認してください。</div>';
      return;
    }

    const root = await AdminShell.mount(app, {
      active: "inquiries",
      pageTitle: "お問い合わせ一覧",
      pageSubtitle: "サイトから届いたお問い合わせの確認・対応",
    });

    root.innerHTML = `
      <section class="adm-panel adm-panel--full" aria-labelledby="adm-inquiries-title">
        <div class="adm-panel-head">
          <h2 class="adm-panel-title" id="adm-inquiries-title">お問い合わせ</h2>
          <span class="adm-inquiries-badge" id="adm-inquiries-new-count">—</span>
        </div>
        <div class="adm-panel-body" id="adm-inquiries-root"></div>
      </section>`;

    await AdminInquiries.mount(document.getElementById("adm-inquiries-root"));
  } catch (err) {
    console.error("[カウマエ] お問い合わせ一覧", err);
    app.innerHTML = `<div class="adm-empty-state" style="padding:4rem">${App.escapeHtml(err.message || "読み込みに失敗しました")}</div>`;
  }
});
