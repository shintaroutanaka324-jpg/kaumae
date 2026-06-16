(function () {
  const NAV = [
    { id: "dashboard", label: "ダッシュボード", href: "admin-dashboard.html", icon: "grid" },
    { id: "services", label: "登録管理", href: "admin-services.html", icon: "box" },
    { id: "reviews", label: "口コミ管理", href: "admin.html", icon: "message" },
    { id: "inquiries", label: "お問い合わせ一覧", href: "admin-inquiries.html", icon: "mail" },
    { id: "users", label: "ユーザー管理", href: "admin-users.html", soon: true },
    { id: "proofs", label: "購入証明管理", href: "admin.html?tab=pending", icon: "shield" },
    { id: "categories", label: "カテゴリ管理", href: "admin-services.html#categories", soon: true },
    { id: "reports", label: "レポート", href: "admin-dashboard.html#reports", soon: true },
    { id: "settings", label: "設定", href: "account-settings.html", soon: true },
    { id: "withdrawals", label: "退会ユーザー", href: "admin-withdrawals.html", icon: "users", adminOnly: true },
  ];

  const ICONS = {
    grid: '<svg class="adm-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    box: '<svg class="adm-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
    message: '<svg class="adm-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    shield: '<svg class="adm-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    users: '<svg class="adm-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    mail: '<svg class="adm-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  };

  function navIcon(name) {
    return ICONS[name] || ICONS.grid;
  }

  function getUserInitial() {
    const name = window.Auth?.getUserName?.() || "管";
    return name.charAt(0).toUpperCase();
  }

  function renderSidebar(activeId) {
    const links = NAV.map((item) => {
      const active = item.id === activeId;
      const soon = item.soon ? ' <span style="font-size:0.65rem;color:#9ca3af">(準備中)</span>' : "";
      const pendingAttr = item.id === "reviews" ? ' data-pending-badge="reviews-nav"' : "";
      return `<a href="${item.href}" class="adm-nav-item ${active ? "active" : ""} ${item.soon ? "is-disabled" : ""}"${pendingAttr}>${navIcon(item.icon || "grid")}<span class="adm-nav-label">${App.escapeHtml(item.label)}${soon}</span></a>`;
    }).join("");

    return `
      <aside class="adm-sidebar" id="adm-sidebar">
        <a href="index.html" class="adm-sidebar-brand" title="カウマエ トップページへ戻る">
          <img src="images/logo.png" alt="カウマエ" width="32" height="32" />
          <span>カウマエ</span>
        </a>
        <nav class="adm-nav" aria-label="運営メニュー">${links}</nav>
        <div class="adm-sidebar-foot">運営管理コンソール</div>
      </aside>`;
  }

  function renderTopbar({ searchPlaceholder = "提供者・カテゴリで検索...", onSearch } = {}) {
    return `
      <header class="adm-topbar">
        <button type="button" class="adm-mobile-menu-btn" id="adm-menu-toggle" aria-label="メニュー">☰</button>
        <div class="adm-topbar-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input type="search" id="adm-global-search" placeholder="${App.escapeHtml(searchPlaceholder)}" autocomplete="off" />
        </div>
        <div class="adm-topbar-actions">
          <a href="admin.html?tab=pending" class="adm-icon-btn adm-icon-btn--notify" id="adm-notify-btn" title="審査待ちの口コミ" aria-label="審査待ち通知">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </a>
          <div class="adm-user-chip">
            <span class="adm-user-avatar">${App.escapeHtml(getUserInitial())}</span>
            <div class="adm-user-meta">
              <div class="adm-user-name">${App.escapeHtml(Auth.getUserName?.() || "管理者")}</div>
              <div class="adm-user-role">管理者</div>
            </div>
          </div>
        </div>
      </header>`;
  }

  async function mount(container, options = {}) {
    const { active = "services", pageTitle = "", pageSubtitle = "" } = options;

    container.className = "adm-app";
    container.innerHTML = `
      ${renderSidebar(active)}
      <div class="adm-main">
        ${renderTopbar(options)}
        <div class="adm-page">
          ${
            pageTitle
              ? `<div class="adm-page-head">
                  <div>
                    <h1 class="adm-page-title">${App.escapeHtml(pageTitle)}</h1>
                    ${pageSubtitle ? `<p class="adm-page-sub">${App.escapeHtml(pageSubtitle)}</p>` : ""}
                  </div>
                  <div id="adm-page-actions"></div>
                </div>`
              : ""
          }
          <div id="admin-page-content"></div>
        </div>
      </div>`;

    document.getElementById("adm-menu-toggle")?.addEventListener("click", () => {
      document.getElementById("adm-sidebar")?.classList.toggle("is-open");
    });

    const searchInput = document.getElementById("adm-global-search");
    if (searchInput && options.onSearch) {
      let timer;
      searchInput.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => options.onSearch(searchInput.value.trim()), 200);
      });
    }

    if (window.AdminPendingCount?.refresh) {
      await AdminPendingCount.refresh();
    }

    return document.getElementById("admin-page-content");
  }

  window.AdminShell = { mount, NAV };
})();
