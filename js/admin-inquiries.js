(function () {
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
    if (status === "in_progress") return "adm-inquiry-status is-progress";
    return "adm-inquiry-status is-new";
  }

  function renderRow(row) {
    return `
      <tr data-inquiry-id="${App.escapeHtml(row.id)}">
        <td>${formatDate(row.created_at)}</td>
        <td>${App.escapeHtml(row.name)}</td>
        <td><a href="mailto:${App.escapeHtml(row.email)}">${App.escapeHtml(row.email)}</a></td>
        <td>${App.escapeHtml(ContactApi.getSubjectLabel(row.subject))}</td>
        <td><span class="${statusClass(row.status)}">${App.escapeHtml(ContactApi.getStatusLabel(row.status))}</span></td>
        <td class="adm-inquiry-actions">
          <button type="button" class="adm-btn-ghost adm-inquiry-detail" data-id="${App.escapeHtml(row.id)}">詳細</button>
          ${
            row.status !== "in_progress"
              ? `<button type="button" class="adm-btn-ghost adm-inquiry-status-btn" data-id="${App.escapeHtml(row.id)}" data-status="in_progress">対応中</button>`
              : ""
          }
          ${
            row.status !== "resolved"
              ? `<button type="button" class="adm-btn-ghost adm-inquiry-status-btn" data-id="${App.escapeHtml(row.id)}" data-status="resolved">完了</button>`
              : ""
          }
        </td>
      </tr>
      <tr class="adm-inquiry-detail-row hidden" data-detail-for="${App.escapeHtml(row.id)}">
        <td colspan="6">
          <div class="adm-inquiry-detail-body">
            <p class="adm-inquiry-message">${App.escapeHtml(row.message).replace(/\n/g, "<br>")}</p>
            ${
              row.admin_note
                ? `<p class="adm-inquiry-note"><strong>メモ:</strong> ${App.escapeHtml(row.admin_note)}</p>`
                : ""
            }
            <label class="adm-inquiry-note-field">
              <span>運営メモ</span>
              <textarea class="form-textarea adm-inquiry-note-input" rows="2" data-id="${App.escapeHtml(row.id)}">${App.escapeHtml(row.admin_note || "")}</textarea>
            </label>
            <button type="button" class="adm-btn-primary adm-inquiry-save-note" data-id="${App.escapeHtml(row.id)}">メモを保存</button>
          </div>
        </td>
      </tr>`;
  }

  function renderTable(rows) {
    if (!rows.length) {
      return '<p class="admin-empty">お問い合わせはまだありません。</p>';
    }

    return `
      <div class="adm-inquiry-table-wrap">
        <table class="adm-inquiry-table">
          <thead>
            <tr>
              <th>受付日時</th>
              <th>お名前</th>
              <th>メール</th>
              <th>件名</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>${rows.map(renderRow).join("")}</tbody>
        </table>
      </div>`;
  }

  function bindActions(container, reload) {
    container.querySelectorAll(".adm-inquiry-detail").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const row = container.querySelector(`tr[data-detail-for="${id}"]`);
        row?.classList.toggle("hidden");
      });
    });

    container.querySelectorAll(".adm-inquiry-status-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const status = btn.dataset.status;
        btn.disabled = true;
        try {
          await ContactApi.updateInquiryStatus(id, status);
          App.showToast("状態を更新しました");
          await reload();
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });

    container.querySelectorAll(".adm-inquiry-save-note").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const note = container.querySelector(`.adm-inquiry-note-input[data-id="${id}"]`)?.value ?? "";
        btn.disabled = true;
        try {
          const row = container._inquiries?.find((item) => item.id === id);
          await ContactApi.updateInquiryStatus(id, row?.status || "new", note);
          App.showToast("メモを保存しました");
          await reload();
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });
  }

  async function mount(container) {
    if (!container) return;

    container.innerHTML = `<p class="admin-empty">読み込み中...</p>`;

    async function reload() {
      try {
        const rows = await ContactApi.fetchInquiries();
        container._inquiries = rows;
        const newCount = rows.filter((row) => row.status === "new").length;
        const badge = document.getElementById("adm-inquiries-new-count");
        if (badge) {
          badge.textContent = newCount > 0 ? `未対応 ${newCount}件` : "未対応 0件";
          badge.classList.toggle("is-alert", newCount > 0);
        }
        container.innerHTML = renderTable(rows);
        bindActions(container, reload);
      } catch (err) {
        container.innerHTML = `<p class="admin-empty">${App.escapeHtml(err.message)}</p>`;
      }
    }

    await reload();
  }

  window.AdminInquiries = { mount };
})();
