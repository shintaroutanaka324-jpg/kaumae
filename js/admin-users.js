(function () {
  let contentRoot = null;
  let allProfiles = [];
  let withdrawnRows = [];
  let auditRows = [];
  let activeTab = "users";
  let searchQuery = "";

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
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) => {
      return (
        String(row.email || "").toLowerCase().includes(q) ||
        String(row.display_name || "").toLowerCase().includes(q) ||
        String(row.id || "").toLowerCase().includes(q) ||
        String(row.stripe_customer_id || "").toLowerCase().includes(q) ||
        String(row.stripe_subscription_id || "").toLowerCase().includes(q)
      );
    });
  }

  function renderKpis() {
    const total = allProfiles.length;
    const paid = allProfiles.filter((p) => AdminUsersApi.isActiveSubscription(p)).length;
    const posted = allProfiles.filter((p) => p.has_posted_review).length;
    const withdrawn = withdrawnRows.length;

    return `
      <div class="adm-kpi-row adm-users-kpis">
        <div class="adm-kpi-card"><div class="adm-kpi-label">登録ユーザー</div><div class="adm-kpi-value">${total.toLocaleString("ja-JP")}</div></div>
        <div class="adm-kpi-card"><div class="adm-kpi-label">有料会員</div><div class="adm-kpi-value">${paid.toLocaleString("ja-JP")}</div></div>
        <div class="adm-kpi-card"><div class="adm-kpi-label">口コミ投稿者</div><div class="adm-kpi-value">${posted.toLocaleString("ja-JP")}</div></div>
        <div class="adm-kpi-card"><div class="adm-kpi-label">退会済み</div><div class="adm-kpi-value">${withdrawn.toLocaleString("ja-JP")}</div></div>
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
    if (!rows.length) {
      return '<p class="adm-empty-state">該当するユーザーがありません。</p>';
    }

    const body = rows
      .map(
        (row) => `
        <tr>
          <td>
            <div class="adm-users-name">${App.escapeHtml(row.display_name || "—")}</div>
            <div class="adm-users-sub">${App.escapeHtml(row.email || "—")}</div>
          </td>
          <td><code class="adm-users-id" title="${App.escapeHtml(row.id)}">${App.escapeHtml(shortId(row.id))}</code></td>
          <td>${formatDate(row.created_at)}</td>
          <td>${row.has_posted_review ? '<span class="adm-badge adm-badge--ok">あり</span>' : "—"}</td>
          <td>${row.is_admin ? '<span class="adm-badge adm-badge--admin">運営</span>' : "—"}</td>
        </tr>`
      )
      .join("");

    return `
      <div class="adm-table-wrap">
        <table class="adm-table adm-table--users">
          <thead>
            <tr>
              <th>ユーザー</th>
              <th>ID</th>
              <th>登録日</th>
              <th>口コミ投稿</th>
              <th>権限</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function renderSubscriptionTable(rows) {
    const subs = rows.filter(
      (row) =>
        row.stripe_subscription_id ||
        row.stripe_customer_id ||
        row.is_paid ||
        row.is_paid_member ||
        row.subscription_status
    );
    const filtered = filterProfiles(subs);

    if (!filtered.length) {
      return '<p class="adm-empty-state">サブスクリプション情報のあるユーザーはいません。</p>';
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
  }

  async function reloadData() {
    const [profiles, withdrawn, audits] = await Promise.all([
      AdminUsersApi.loadProfilesAdmin(),
      AdminUsersApi.loadWithdrawnUsersAdmin(),
      AdminUsersApi.loadWithdrawalAuditLogsAdmin(),
    ]);
    allProfiles = profiles;
    withdrawnRows = withdrawn;
    auditRows = audits;
    render();
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

    contentRoot.querySelectorAll("[data-billing-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        handleBillingAction(btn.dataset.billingAction, btn.dataset.userId, btn);
      });
    });
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
    await reloadData();
  }

  function setSearchQuery(q) {
    searchQuery = q;
    render();
  }

  window.AdminUsers = { mount, setSearchQuery };
})();
