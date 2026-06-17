(function () {
  let contentRoot = null;
  let allProfiles = [];
  let withdrawnRows = [];
  let auditRows = [];
  let activeTab = "users";
  let searchQuery = "";
  let userFilter = "all";
  let subFilter = "all";

  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("ja-JP");
  }

  function shortId(id) {
    const raw = String(id || "");
    if (raw.length <= 12) return raw;
    return `${raw.slice(0, 8)}…`;
  }

  function getInitialTab() {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "subscriptions" || tab === "withdrawals") return tab;
    return "users";
  }

  function syncUrlTab() {
    const url = new URL(window.location.href);
    if (activeTab === "users") url.searchParams.delete("tab");
    else url.searchParams.set("tab", activeTab);
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  }

  function filterProfiles(list) {
    let rows = list;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) => {
        return (
          String(row.email || "").toLowerCase().includes(q) ||
          String(row.display_name || "").toLowerCase().includes(q) ||
          String(row.id || "").toLowerCase().includes(q) ||
          String(row.stripe_customer_id || "").toLowerCase().includes(q) ||
          String(row.stripe_subscription_id || "").toLowerCase().includes(q) ||
          String(row.age_group || "").toLowerCase().includes(q) ||
          String(row.gender || "").toLowerCase().includes(q)
        );
      });
    }

    if (activeTab === "users" && userFilter !== "all") {
      rows = rows.filter((row) => {
        if (userFilter === "paid") return AdminUsersApi.isActiveSubscription(row);
        if (userFilter === "posted") return row.has_posted_review;
        if (userFilter === "admin") return row.is_admin;
        return true;
      });
    }

    return rows;
  }

  function renderPlanBadge(row) {
    const active = AdminUsersApi.isActiveSubscription(row);
    const label = AdminUsersApi.subscriptionStatusLabel(row.subscription_status) || (active ? "有料" : "無料");
    return `<span class="adm-sub-status ${active ? "is-active" : "is-inactive"}">${App.escapeHtml(label)}</span>`;
  }

  function renderDemographics(row) {
    const parts = [row.age_group, row.gender].filter(Boolean);
    return parts.length ? App.escapeHtml(parts.join(" / ")) : "—";
  }

  function renderUserFilterChips() {
    const chips = [
      { id: "all", label: "すべて" },
      { id: "paid", label: "有料会員" },
      { id: "posted", label: "口コミ投稿者" },
      { id: "admin", label: "運営者" },
    ];
    return `
      <div class="adm-toolbar adm-users-filters">
        ${chips
          .map(
            (chip) => `
          <button type="button" class="adm-chip ${userFilter === chip.id ? "active" : ""}" data-user-filter="${chip.id}">
            ${App.escapeHtml(chip.label)}
          </button>`
          )
          .join("")}
      </div>`;
  }

  function renderSubFilterChips() {
    const chips = [
      { id: "all", label: "すべて" },
      { id: "active", label: "有効" },
      { id: "inactive", label: "無効・未加入" },
    ];
    return `
      <div class="adm-toolbar adm-users-filters">
        ${chips
          .map(
            (chip) => `
          <button type="button" class="adm-chip ${subFilter === chip.id ? "active" : ""}" data-sub-filter="${chip.id}">
            ${App.escapeHtml(chip.label)}
          </button>`
          )
          .join("")}
      </div>`;
  }

  function renderAdminRoleCell(row) {
    const isAdmin = Boolean(row.is_admin);
    const currentUserId = window.Auth?.getUser?.()?.id;
    const isSelf = currentUserId && row.id === currentUserId;
    const toggleTitle = isAdmin
      ? isSelf
        ? "運営者（自分の権限はここから解除できません）"
        : "運営者（クリックで解除）"
      : "一般ユーザー（クリックで運営権限を付与）";
    const disabledAttr = isAdmin && isSelf ? " disabled" : "";

    return `
      <div class="adm-admin-role-cell">
        <button type="button" class="adm-toggle ${isAdmin ? "is-on" : ""}" data-admin-action="toggle-admin" data-user-id="${App.escapeHtml(row.id)}" data-is-admin="${isAdmin ? "1" : "0"}" aria-label="${toggleTitle}" title="${toggleTitle}"${disabledAttr}></button>
        ${isAdmin ? '<span class="adm-badge adm-badge--admin">運営</span>' : ""}
      </div>`;
  }

  function renderUserDetailRow(row) {
    const active = AdminUsersApi.isActiveSubscription(row);
    return `
      <tr class="adm-users-detail-row hidden" data-detail-for="${App.escapeHtml(row.id)}">
        <td colspan="7">
          <div class="adm-users-detail-body">
            <dl class="adm-users-detail-grid">
              <div><dt>ユーザーID</dt><dd><code>${App.escapeHtml(row.id)}</code></dd></div>
              <div><dt>Stripe Customer</dt><dd><code>${App.escapeHtml(row.stripe_customer_id || "—")}</code></dd></div>
              <div><dt>Stripe Subscription</dt><dd><code>${App.escapeHtml(row.stripe_subscription_id || "—")}</code></dd></div>
              <div><dt>最終更新</dt><dd>${formatDateTime(row.updated_at)}</dd></div>
              <div><dt>運営権限</dt><dd>${row.is_admin ? "付与済み" : "なし"}</dd></div>
            </dl>
            <p class="adm-users-note">運営権限の付与・解除は一覧のトグルから行えます（Edge Function 経由で安全に更新）。</p>
            ${
              active || row.stripe_subscription_id
                ? `<div class="adm-row-actions adm-row-actions--wrap adm-users-detail-actions">
                    <button type="button" class="adm-btn-ghost" data-billing-action="sync" data-user-id="${App.escapeHtml(row.id)}">Stripe同期</button>
                    <button type="button" class="adm-btn-ghost" data-billing-action="portal" data-user-id="${App.escapeHtml(row.id)}">Stripe管理</button>
                    <button type="button" class="adm-btn-ghost" data-billing-action="cancel-end" data-user-id="${App.escapeHtml(row.id)}">期末解約</button>
                    <button type="button" class="adm-btn-ghost is-danger" data-billing-action="cancel-now" data-user-id="${App.escapeHtml(row.id)}">即時解約</button>
                  </div>`
                : ""
            }
          </div>
        </td>
      </tr>`;
  }

  function renderKpis() {
    const summary = AdminUsersApi.computeSummary(allProfiles, withdrawnRows);

    return `
      <div class="adm-kpi-row adm-users-kpis">
        <div class="adm-kpi-card"><div class="adm-kpi-label">登録ユーザー</div><div class="adm-kpi-value">${summary.total.toLocaleString("ja-JP")}</div></div>
        <div class="adm-kpi-card"><div class="adm-kpi-label">有料会員</div><div class="adm-kpi-value">${summary.paid.toLocaleString("ja-JP")}</div></div>
        <div class="adm-kpi-card"><div class="adm-kpi-label">口コミ投稿者</div><div class="adm-kpi-value">${summary.posted.toLocaleString("ja-JP")}</div></div>
        <div class="adm-kpi-card"><div class="adm-kpi-label">退会済み</div><div class="adm-kpi-value">${summary.withdrawn.toLocaleString("ja-JP")}</div></div>
      </div>`;
  }

  function renderDashboardPreview() {
    const summary = AdminUsersApi.computeSummary(allProfiles, withdrawnRows);
    const recent = AdminUsersApi.getRecentProfiles(allProfiles, 5);

    const rows = recent.length
      ? recent
          .map(
            (row) => `
          <tr>
            <td>
              <div class="adm-users-name">${App.escapeHtml(row.display_name || "—")}</div>
              <div class="adm-users-sub">${App.escapeHtml(row.email || "—")}</div>
            </td>
            <td>${formatDate(row.created_at)}</td>
            <td>${renderPlanBadge(row)}</td>
            <td>${row.has_posted_review ? "あり" : "—"}</td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="adm-empty-state">登録ユーザーはまだいません。</td></tr>`;

    return `
      <div class="adm-users-dash-summary">
        <div class="adm-users-dash-stats">
          <span>登録 <strong>${summary.total}</strong></span>
          <span>有料 <strong>${summary.paid}</strong></span>
          <span>投稿者 <strong>${summary.posted}</strong></span>
          <span>退会 <strong>${summary.withdrawn}</strong></span>
        </div>
        <div class="adm-table-wrap">
          <table class="adm-table adm-table--users adm-table--compact">
            <thead>
              <tr>
                <th>ユーザー</th>
                <th>登録日</th>
                <th>プラン</th>
                <th>口コミ</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="adm-users-dash-links">
          <a href="admin-users.html" class="adm-quick-btn is-primary">ユーザー管理へ</a>
          <a href="admin-users.html?tab=subscriptions" class="adm-quick-btn">サブスク管理</a>
          <a href="admin-users.html?tab=withdrawals" class="adm-quick-btn">退会ユーザー</a>
        </div>
      </div>`;
  }

  function renderTabs() {
    const tabs = [
      { id: "users", label: "ユーザー一覧" },
      { id: "subscriptions", label: "サブスクリプション" },
      { id: "withdrawals", label: "退会ユーザー" },
    ];

    return `
      <div class="adm-users-tabs" role="tablist">
        ${tabs
          .map(
            (tab) => `
          <button
            type="button"
            class="adm-users-tab ${activeTab === tab.id ? "is-active" : ""}"
            data-users-tab="${tab.id}"
            role="tab"
            aria-selected="${activeTab === tab.id ? "true" : "false"}"
          >${App.escapeHtml(tab.label)}</button>`
          )
          .join("")}
      </div>`;
  }

  function renderUserTable(rows) {
    const filtered = filterProfiles(rows);
    if (!filtered.length) {
      return `${renderUserFilterChips()}<p class="adm-empty-state">該当するユーザーがありません。</p>`;
    }

    const body = filtered
      .map(
        (row) => `
        <tr data-user-id="${App.escapeHtml(row.id)}">
          <td>
            <div class="adm-users-name">${App.escapeHtml(row.display_name || "—")}</div>
            <div class="adm-users-sub">${App.escapeHtml(row.email || "—")}</div>
          </td>
          <td>${formatDate(row.created_at)}</td>
          <td>${renderPlanBadge(row)}</td>
          <td>${row.has_posted_review ? '<span class="adm-badge adm-badge--ok">あり</span>' : "—"}</td>
          <td>${renderDemographics(row)}</td>
          <td>${renderAdminRoleCell(row)}</td>
          <td>
            <button type="button" class="adm-btn-ghost adm-users-detail-btn" data-user-id="${App.escapeHtml(row.id)}">詳細</button>
          </td>
        </tr>
        ${renderUserDetailRow(row)}`
      )
      .join("");

    return `
      ${renderUserFilterChips()}
      <div class="adm-table-wrap">
        <table class="adm-table adm-table--users">
          <thead>
            <tr>
              <th>ユーザー</th>
              <th>登録日</th>
              <th>プラン</th>
              <th>口コミ投稿</th>
              <th>属性</th>
              <th>権限</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function renderSubscriptionTable(rows) {
    let subs = rows.filter(
      (row) =>
        row.stripe_subscription_id ||
        row.stripe_customer_id ||
        row.is_paid ||
        row.is_paid_member ||
        row.subscription_status
    );

    if (subFilter === "active") {
      subs = subs.filter((row) => AdminUsersApi.isActiveSubscription(row));
    } else if (subFilter === "inactive") {
      subs = subs.filter((row) => !AdminUsersApi.isActiveSubscription(row));
    }

    const filtered = filterProfiles(subs);

    if (!filtered.length) {
      return `${renderSubFilterChips()}<p class="adm-empty-state">サブスクリプション情報のあるユーザーはいません。</p>`;
    }

    const body = filtered
      .map((row) => {
        const status = AdminUsersApi.subscriptionStatusLabel(row.subscription_status);
        const active = AdminUsersApi.isActiveSubscription(row);
        return `
        <tr data-user-id="${App.escapeHtml(row.id)}">
          <td>
            <div class="adm-users-name">${App.escapeHtml(row.display_name || "—")}</div>
            <div class="adm-users-sub">${App.escapeHtml(row.email || "—")}</div>
          </td>
          <td><span class="adm-sub-status ${active ? "is-active" : "is-inactive"}">${App.escapeHtml(status)}</span></td>
          <td><code class="adm-users-id" title="${App.escapeHtml(row.stripe_customer_id || "")}">${App.escapeHtml(shortId(row.stripe_customer_id || "—"))}</code></td>
          <td><code class="adm-users-id" title="${App.escapeHtml(row.stripe_subscription_id || "")}">${App.escapeHtml(shortId(row.stripe_subscription_id || "—"))}</code></td>
          <td>
            <div class="adm-row-actions adm-row-actions--wrap">
              <button type="button" class="adm-action-btn" data-billing-action="sync" data-user-id="${App.escapeHtml(row.id)}" title="Stripeから同期">↻</button>
              <button type="button" class="adm-action-btn" data-billing-action="portal" data-user-id="${App.escapeHtml(row.id)}" title="Stripe管理">💳</button>
              <button type="button" class="adm-action-btn" data-billing-action="cancel-end" data-user-id="${App.escapeHtml(row.id)}" title="期末解約">⏸</button>
              <button type="button" class="adm-action-btn is-danger" data-billing-action="cancel-now" data-user-id="${App.escapeHtml(row.id)}" title="即時解約">✕</button>
            </div>
          </td>
        </tr>`;
      })
      .join("");

    return `
      ${renderSubFilterChips()}
      <p class="adm-users-note">Stripe との同期・解約・顧客ポータルは運営操作として実行されます。</p>
      <div class="adm-table-wrap">
        <table class="adm-table adm-table--users">
          <thead>
            <tr>
              <th>ユーザー</th>
              <th>ステータス</th>
              <th>Customer ID</th>
              <th>Subscription ID</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function renderWithdrawnTable(rows) {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (row) =>
            String(row.email || "").toLowerCase().includes(q) ||
            String(row.user_id || "").toLowerCase().includes(q) ||
            String(row.reason || "").toLowerCase().includes(q)
        )
      : rows;

    if (!filtered.length) {
      return '<p class="adm-empty-state">退会ユーザーの記録はまだありません。</p>';
    }

    const body = filtered
      .map(
        (row) => `
        <tr>
          <td>${App.escapeHtml(row.email || "—")}</td>
          <td><code class="adm-users-id" title="${App.escapeHtml(row.user_id)}">${App.escapeHtml(shortId(row.user_id))}</code></td>
          <td>${formatDateTime(row.withdrawn_at)}</td>
          <td>${App.escapeHtml(window.AccountApi?.reasonLabel?.(row.reason) || row.reason || "—")}${
            row.reason_other
              ? `<div class="adm-users-sub">${App.escapeHtml(row.reason_other)}</div>`
              : ""
          }</td>
          <td>${row.review_count ?? 0}</td>
          <td>${row.purchase_proof_deleted ? '<span class="adm-badge adm-badge--ok">削除済み</span>' : "—"}</td>
        </tr>`
      )
      .join("");

    return `
      <div class="adm-table-wrap">
        <table class="adm-table adm-table--users">
          <thead>
            <tr>
              <th>メール</th>
              <th>ユーザーID</th>
              <th>退会日時</th>
              <th>退会理由</th>
              <th>口コミ数</th>
              <th>購入証明</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function renderAuditTable(rows) {
    if (!rows.length) return "";

    const body = rows
      .slice(0, 50)
      .map(
        (row) => `
        <tr>
          <td><code class="adm-users-id">${App.escapeHtml(shortId(row.user_id))}</code></td>
          <td>${formatDateTime(row.withdrawn_at)}</td>
          <td>${App.escapeHtml(window.AccountApi?.reasonLabel?.(row.reason) || row.reason || "—")}</td>
          <td>${App.escapeHtml(row.result || "—")}</td>
          <td>${App.escapeHtml(row.purchase_proof_deletion_result || "—")}</td>
        </tr>`
      )
      .join("");

    return `
      <div class="adm-panel adm-panel--nested">
        <div class="adm-panel-head"><h3 class="adm-panel-title">監査ログ（最新50件）</h3></div>
        <div class="adm-panel-body">
          <div class="adm-table-wrap">
            <table class="adm-table adm-table--users">
              <thead>
                <tr>
                  <th>ユーザーID</th>
                  <th>退会日時</th>
                  <th>理由</th>
                  <th>処理結果</th>
                  <th>購入証明削除</th>
                </tr>
              </thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  function renderTabPanel() {
    if (activeTab === "subscriptions") {
      return renderSubscriptionTable(allProfiles);
    }
    if (activeTab === "withdrawals") {
      return renderWithdrawnTable(withdrawnRows) + renderAuditTable(auditRows);
    }
    return renderUserTable(filterProfiles(allProfiles));
  }

  function render() {
    if (!contentRoot) return;
    contentRoot.innerHTML = `
      ${renderKpis()}
      ${renderTabs()}
      <section class="adm-panel adm-panel--full">
        <div class="adm-panel-body">${renderTabPanel()}</div>
      </section>`;
    bindEvents();
    setPageActions();
  }

  async function reloadData() {
    const [profiles, withdrawn, audits] = await Promise.all([
      AdminUsersApi.loadProfilesAdmin(),
      AdminUsersApi.loadWithdrawnUsersAdmin().catch((err) => {
        console.warn("[カウマエ] 退会ユーザー", err.message);
        return [];
      }),
      AdminUsersApi.loadWithdrawalAuditLogsAdmin().catch((err) => {
        console.warn("[カウマエ] 退会監査ログ", err.message);
        return [];
      }),
    ]);
    allProfiles = profiles;
    withdrawnRows = withdrawn;
    auditRows = audits;
    render();
  }

  async function handleAdminToggle(userId, currentlyAdmin, button) {
    if (!userId) return;

    const nextAdmin = !currentlyAdmin;
    const message = nextAdmin
      ? "このユーザーに運営権限を付与します。ダッシュボードの全管理機能にアクセスできるようになります。よろしいですか？"
      : "このユーザーの運営権限を解除します。よろしいですか？";

    if (!window.confirm(message)) return;

    if (button) button.disabled = true;

    try {
      const result = await AdminUsersApi.setUserAdminRole(userId, nextAdmin);
      App.showToast(result?.message || "運営権限を更新しました");
      await reloadData();
    } catch (err) {
      App.showToast(err.message || "更新に失敗しました", "error");
      if (button) button.disabled = false;
    }
  }

  async function handleBillingAction(action, userId, button) {
    if (!userId) return;

    if (action === "cancel-now") {
      const ok = window.confirm("このユーザーのサブスクリプションを即時解約します。よろしいですか？");
      if (!ok) return;
    }
    if (action === "cancel-end") {
      const ok = window.confirm("このユーザーのサブスクリプションを期間終了時に解約します。よろしいですか？");
      if (!ok) return;
    }

    if (button) {
      button.disabled = true;
    }

    try {
      let result;
      if (action === "sync") {
        result = await AdminUsersApi.callAdminBilling({ action: "sync", userId });
      } else if (action === "portal") {
        result = await AdminUsersApi.callAdminBilling({ action: "portal", userId });
        if (result.url) {
          window.open(result.url, "_blank", "noopener,noreferrer");
        }
      } else if (action === "cancel-end") {
        result = await AdminUsersApi.callAdminBilling({ action: "cancel", userId, atPeriodEnd: true });
      } else if (action === "cancel-now") {
        result = await AdminUsersApi.callAdminBilling({ action: "cancel", userId, atPeriodEnd: false });
      }

      App.showToast(result?.message || "操作が完了しました");
      await reloadData();
    } catch (err) {
      App.showToast(err.message || "操作に失敗しました", "error");
      if (button) button.disabled = false;
    }
  }

  function bindEvents() {
    contentRoot.querySelectorAll("[data-users-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.usersTab || "users";
        syncUrlTab();
        render();
      });
    });

    contentRoot.querySelectorAll("[data-user-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        userFilter = btn.dataset.userFilter || "all";
        render();
      });
    });

    contentRoot.querySelectorAll("[data-sub-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        subFilter = btn.dataset.subFilter || "all";
        render();
      });
    });

    contentRoot.querySelectorAll(".adm-users-detail-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.userId;
        const row = contentRoot.querySelector(`tr[data-detail-for="${id}"]`);
        row?.classList.toggle("hidden");
      });
    });

    contentRoot.querySelectorAll("[data-admin-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        handleAdminToggle(btn.dataset.userId, btn.dataset.isAdmin === "1", btn);
      });
    });

    contentRoot.querySelectorAll("[data-billing-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        handleBillingAction(btn.dataset.billingAction, btn.dataset.userId, btn);
      });
    });
  }

  function setPageActions() {
    const actionsEl = document.getElementById("adm-page-actions");
    if (!actionsEl) return;
    actionsEl.innerHTML = `
      <button type="button" class="adm-btn-ghost" id="adm-users-refresh" title="再読み込み">↻ 更新</button>`;
    document.getElementById("adm-users-refresh")?.addEventListener("click", () => reloadData());
  }

  async function mount(root, { onSearch } = {}) {
    contentRoot = root;
    activeTab = getInitialTab();
    searchQuery = "";

    if (typeof onSearch === "function") {
      window.AdminUsers = window.AdminUsers || {};
      window.AdminUsers.setSearchQuery = (q) => {
        searchQuery = q;
        render();
      };
    }

    root.innerHTML = '<p class="adm-empty-state">読み込み中...</p>';
    setPageActions();
    await reloadData();
  }

  async function mountDashboardPreview(root) {
    if (!root) return;
    root.innerHTML = '<p class="adm-empty-state">読み込み中...</p>';
    try {
      const [profiles, withdrawn] = await Promise.all([
        AdminUsersApi.loadProfilesAdmin(),
        AdminUsersApi.loadWithdrawnUsersAdmin().catch(() => []),
      ]);
      allProfiles = profiles;
      withdrawnRows = withdrawn;
      root.innerHTML = renderDashboardPreview();
    } catch (err) {
      root.innerHTML = `<p class="adm-empty-state">${App.escapeHtml(err.message || "ユーザー情報の取得に失敗しました")}</p>`;
    }
  }

  function setSearchQuery(q) {
    searchQuery = q;
    render();
  }

  window.AdminUsers = { mount, mountDashboardPreview, setSearchQuery };
})();
