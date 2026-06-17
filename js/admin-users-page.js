document.addEventListener("DOMContentLoaded", async () => {
  const app = document.getElementById("admin-app");
  if (!app) return;

  try {
    await App.whenReady();

    if (!Auth.isLoggedIn()) {
      window.location.href = "login.html?redirect=admin-users.html";
      return;
    }

    await Auth.ensureProfile?.();

    if (!Auth.isAdmin()) {
      app.innerHTML =
        '<div class="adm-empty-state" style="padding:4rem">運営者権限が必要です。<br>Supabase の <code>profiles</code> テーブルで <code>is_admin = true</code> が設定されているか確認してください。</div>';
      return;
    }

    const root = await AdminShell.mount(app, {
      active: "users",
      pageTitle: "ユーザー管理",
      pageSubtitle: "登録ユーザー・サブスクリプション・退会記録を一元管理",
      searchPlaceholder: "メール・名前・IDで検索...",
      onSearch: (q) => AdminUsers.setSearchQuery(q),
    });

    await AdminUsers.mount(root, { onSearch: true });
  } catch (err) {
    console.error("[カウマエ] ユーザー管理", err);
    app.innerHTML = `<div class="adm-empty-state" style="padding:4rem">${App.escapeHtml(err.message || "読み込みに失敗しました")}</div>`;
  }
});
