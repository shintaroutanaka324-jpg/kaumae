(function () {
  let statusFilter = "all";

  function formatDate(iso) {
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

  function statusClass(status) {
    if (status === "resolved") return "adm-inquiry-status is-resolved";
    if (status === "rejected") return "adm-inquiry-status is-rejected";
    if (status === "in_progress") return "adm-inquiry-status is-progress";
    return "adm-inquiry-status is-new";
  }

  function renderFilterChips() {
    const chips = [
      { id: "all", label: "すべて" },
      { id: "new", label: "未対応" },
      { id: "in_progress", label: "対応中" },
      { id: "resolved", label: "完了" },
      { id: "rejected", label: "却下" },
    ];
    return `
      <div class="adm-toolbar adm-deletion-filters">
        ${chips
          .map(
            (chip) => `
          <button type="button" class="adm-chip ${statusFilter === chip.id ? "active" : ""}" data-deletion-filter="${chip.id}">
            ${App.escapeHtml(chip.label)}
          </button>`
          )
          .join("")}
      </div>`;
  }

  function safeExternalUrl(url) {
    try {
      const parsed = new URL(String(url || "").trim());
      if (parsed.protocol !== "https:") return null;
      return parsed.href;
    } catch {
      return null;
    }
  }

  function renderTargetUrl(url) {
    const safe = safeExternalUrl(url);
    if (!safe) return App.escapeHtml(url || "—");
    return `<a href="${App.escapeHtml(safe)}" target="_blank" rel="noopener noreferrer" class="adm-deletion-url">${App.escapeHtml(safe)}</a>`;
  }

  function renderRow(row) {
    return `
      <tr data-deletion-id="${App.escapeHtml(row.id)}">
        <td>${formatDate(row.created_at)}</td>
        <td>${App.escapeHtml(row.name)}</td>
        <td><a href="mailto:${App.escapeHtml(row.email)}">${App.escapeHtml(row.email)}</a></td>
        <td>${App.escapeHtml(DeletionRequestApi.getTypeLabel(row.request_type))}</td>
        <td class="adm-deletion-url-cell">${renderTargetUrl(row.target_url)}</td>
        <td><span class="${statusClass(row.status)}">${App.escapeHtml(DeletionRequestApi.getStatusLabel(row.status))}</span></td>
        <td class="adm-inquiry-actions">
          <button type="button" class="adm-btn-ghost adm-deletion-detail" data-id="${App.escapeHtml(row.id)}">詳細</button>
          ${
            row.status !== "in_progress"
              ? `<button type="button" class="adm-btn-ghost adm-deletion-status-btn" data-id="${App.escapeHtml(row.id)}" data-status="in_progress">対応中</button>`
              : ""
          }
          ${
            row.status !== "resolved"
              ? `<button type="button" class="adm-btn-ghost adm-deletion-status-btn" data-id="${App.escapeHtml(row.id)}" data-status="resolved">完了</button>`
              : ""
          }
          ${
            row.status !== "rejected"
              ? `<button type="button" class="adm-btn-ghost adm-deletion-status-btn" data-id="${App.escapeHtml(row.id)}" data-status="rejected">却下</button>`
              : ""
          }
        </td>
      </tr>
      <tr class="adm-inquiry-detail-row hidden" data-detail-for="${App.escapeHtml(row.id)}">
        <td colspan="7">
          <div class="adm-inquiry-detail-body">
            <dl class="adm-deletion-detail-meta">
              <div><dt>対象URL</dt><dd>${renderTargetUrl(row.target_url)}</dd></div>
              <div><dt>依頼種別</dt><dd>${App.escapeHtml(DeletionRequestApi.getTypeLabel(row.request_type))}</dd></div>
              <div><dt>最終更新</dt><dd>${formatDate(row.updated_at)}</dd></div>
            </dl>
            <p class="adm-inquiry-message">${App.escapeHtml(row.message).replace(/\n/g, "<br>")}</p>
            ${
              row.admin_note
                ? `<p class="adm-inquiry-note"><strong>メモ:</strong> ${App.escapeHtml(row.admin_note)}</p>`
                : ""
            }
            <label class="adm-inquiry-note-field">
              <span>運営メモ</span>
              <textarea class="form-textarea adm-deletion-note-input" rows="2" data-id="${App.escapeHtml(row.id)}">${App.escapeHtml(row.admin_note || "")}</textarea>
            </label>
            <button type="button" class="adm-btn-primary adm-deletion-save-note" data-id="${App.escapeHtml(row.id)}">メモを保存</button>
          </div>
        </td>
      </tr>`;
  }

  function renderTable(rows) {
    if (!rows.length) {
      return `${renderFilterChips()}<p class="adm-empty-state">削除依頼はまだありません。</p>`;
    }

    return `
      ${renderFilterChips()}
      <div class="adm-inquiry-table-wrap">
        <table class="adm-inquiry-table adm-deletion-table">
          <thead>
            <tr>
              <th>受付日時</th>
              <th>依頼者</th>
              <th>メール</th>
              <th>依頼種別</th>
              <th>対象URL</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>${rows.map(renderRow).join("")}</tbody>
        </table>
      </div>`;
  }

  function bindActions(container, reload) {
    container.querySelectorAll("[data-deletion-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        statusFilter = btn.dataset.deletionFilter || "all";
        reload();
      });
    });

    container.querySelectorAll(".adm-deletion-detail").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const row = container.querySelector(`tr[data-detail-for="${id}"]`);
        row?.classList.toggle("hidden");
      });
    });

    container.querySelectorAll(".adm-deletion-status-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const status = btn.dataset.status;
        btn.disabled = true;
        try {
          await DeletionRequestApi.updateDeletionRequestStatus(id, status);
          App.showToast("状態を更新しました");
          await reload();
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });

    container.querySelectorAll(".adm-deletion-save-note").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const note = container.querySelector(`.adm-deletion-note-input[data-id="${id}"]`)?.value ?? "";
        btn.disabled = true;
        try {
          const row = container._deletionRequests?.find((item) => item.id === id);
          await DeletionRequestApi.updateDeletionRequestStatus(id, row?.status || "new", note);
          App.showToast("メモを保存しました");
          await reload();
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });
  }

  function updateBadge(rows) {
    const newCount = rows.filter((row) => row.status === "new").length;
    const text = newCount > 0 ? `未対応 ${newCount}件` : "未対応 0件";
    ["adm-deletion-new-count", "adm-deletion-dash-count"].forEach((id) => {
      const badge = document.getElementById(id);
      if (!badge) return;
      badge.textContent = text;
      badge.classList.toggle("is-alert", newCount > 0);
    });
  }

  async function mount(container) {
    if (!container) return;

    container.innerHTML = `<p class="adm-empty-state">読み込み中...</p>`;

    async function reload() {
      try {
        const rows = await DeletionRequestApi.fetchDeletionRequests(
          statusFilter === "all" ? {} : { status: statusFilter }
        );
        container._deletionRequests = rows;
        updateBadge(rows);
        container.innerHTML = renderTable(rows);
        bindActions(container, reload);
      } catch (err) {
        const hint = err.message?.includes("deletion_requests")
          ? "<br><small><code>schema-deletion-requests.sql</code> を Supabase で実行してください。</small>"
          : "";
        container.innerHTML = `<p class="adm-empty-state">${App.escapeHtml(err.message)}${hint}</p>`;
      }
    }

    await reload();
  }

  window.AdminDeletionRequests = { mount };
})();
