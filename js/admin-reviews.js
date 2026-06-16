(function () {
  const RATING_LABELS = {
    cost_performance: "コスパ",
    recommendation: "難易度・継続",
    support_quality: "サポート体制",
    content_satisfaction: "満足度",
    result_realization: "実現性・成果",
  };

  const EDITABLE_BODY_FIELDS = [
    { key: "body_pros", label: "良かった点・満足した点", minChars: 100, rows: 5 },
    { key: "body_concerns", label: "気になった点・改善してほしい点", minChars: 30, rows: 4 },
    { key: "body_before", label: "受講前・利用前の状態", minChars: 50, rows: 4 },
    { key: "body_results", label: "受講後・利用後の変化", minChars: 50, rows: 5 },
    { key: "body_recommend", label: "どんな人におすすめしたいか", minChars: 50, rows: 4 },
    { key: "numeric_results", label: "数値で表せる成果", optional: true, rows: 3 },
    { key: "body_other", label: "その他", optional: true, rows: 3 },
  ];

  let currentTab = "all";
  let categoryFilter = "all";
  let serviceFilter = "all";
  let searchQuery = "";
  let listRows = [];
  let allTabRows = [];
  let selectedReviewId = null;
  let contentRoot = null;
  let kpiCache = null;
  const editableRowsById = new Map();

  function formatPeriod(row) {
    if (!row.purchase_year) return "—";
    if (!row.purchase_month) return `${row.purchase_year}年頃`;
    return `${row.purchase_year}年${row.purchase_month}月頃`;
  }

  function refundGuaranteeLabel(value) {
    const map = {
      yes: "返金保証あり",
      no: "返金保証なし",
      unknown: "不明・記載なし",
    };
    return map[value] || "—";
  }

  function isPurchaseProofShownPublicly(row) {
    if (row?.show_purchase_proof === true) return true;
    if (row?.show_purchase_proof === false) return false;
    return Boolean(row?.purchase_proof_path);
  }

  function getPurchaseProofDisplayChoice(row) {
    return isPurchaseProofShownPublicly(row) ? "yes" : "no";
  }

  function renderPurchaseProofDisplayField(row) {
    if (row._isStatic) return "";

    const hasFile = Boolean(row.purchase_proof_path);
    const current = getPurchaseProofDisplayChoice(row);

    if (!hasFile) {
      return `
        <div class="admin-field admin-field--proof-display">
          <span class="form-label">購入証明の公開表示</span>
          <p class="admin-card-meta">ファイル未提出のため、サイト上は「なし」と表示されます。</p>
        </div>`;
    }

    return `
      <div class="admin-field admin-field--proof-display">
        <fieldset class="adm-proof-display-field">
          <legend class="form-label">購入証明の公開表示</legend>
          <p class="form-hint">提出ファイルを確認のうえ、サイト上の「購入証明あり」バッジ・詳細の「あり/なし」表示を選んでください。</p>
          <div class="adm-proof-display-options">
            <label class="adm-proof-display-option">
              <input type="radio" name="show-purchase-proof-${row.id}" value="yes" ${current === "yes" ? "checked" : ""} />
              <span class="adm-proof-display-option-label">あり（購入証明済みバッジを表示）</span>
            </label>
            <label class="adm-proof-display-option">
              <input type="radio" name="show-purchase-proof-${row.id}" value="no" ${current === "no" ? "checked" : ""} />
              <span class="adm-proof-display-option-label">なし（バッジ・記載を非表示）</span>
            </label>
          </div>
        </fieldset>
      </div>`;
  }

  function renderPurchaseProofAdminMeta(row) {
    if (row._isStatic) return "";

    const hasFile = Boolean(row.purchase_proof_path);
    const shown = isPurchaseProofShownPublicly(row);

    return `
      <div class="adm-proof-admin-meta">
        <h4 class="adm-detail-section-title">購入証明</h4>
        <p class="admin-card-meta">
          提出ファイル:
          ${hasFile ? "あり" : "なし"}
          · 公開表示:
          <strong>${shown ? "あり" : "なし"}</strong>
        </p>
        ${
          hasFile
            ? `<button type="button" class="admin-proof-link" data-proof-path="${App.escapeHtml(row.purchase_proof_path)}">提出ファイルを表示</button>`
            : ""
        }
      </div>`;
  }

  function getBodyFieldValue(row, key) {
    if (key === "body_results") return row.body_results || row.body_learnings || "";
    if (key === "body_before") return row.body_before || row.body_situation || "";
    if (key === "numeric_results") return row.numeric_results || row.body_numeric || "";
    return row[key] || "";
  }

  function countAdminChars(value) {
    return [...String(value || "")].length;
  }

  function getReviewCategory(row) {
    if (row._category) return row._category;
    const productId = row.product_id;
    if (productId && typeof getProductById === "function") {
      const product = getProductById(productId);
      if (product?.category) return product.category;
    }
    return "other";
  }

  function legacyReviewToAdminRow(review) {
    const product =
      typeof getProductById === "function" ? getProductById(review.productId) : null;
    return {
      id: review.id,
      status: "approved",
      product_name: product?.title || review.title || "（不明）",
      product_id: review.productId || null,
      created_at: `${review.date}T12:00:00.000Z`,
      purchase_price: review.purchasePrice || 0,
      purchase_year: null,
      purchase_month: null,
      reviewer_display_name: review.userName || "匿名ユーザー",
      cost_performance: review.costPerformance,
      recommendation: review.recommendation,
      support_quality: review.supportQuality,
      content_satisfaction: review.contentSatisfaction,
      result_realization: review.resultRealization,
      body_pros: review.content || review.pros?.[0] || "",
      body_concerns: review.cons?.[0] || "",
      body_before: review.situation || "",
      body_results: review.learned || "",
      body_recommend: "",
      _isStatic: true,
      _category: product?.category || "other",
    };
  }

  function getStaticReviewsForAdmin() {
    if (typeof REVIEWS === "undefined") return [];
    return REVIEWS.map(legacyReviewToAdminRow);
  }

  function annotateReviewRows(rows) {
    return rows.map((row) => ({
      ...row,
      _category: row._category || getReviewCategory(row),
      _isStatic: row._isStatic === true,
    }));
  }

  function getReviewServiceKey(row) {
    if (row.product_id) return row.product_id;
    if (row.product_name) return `name:${row.product_name}`;
    return "__unlinked__";
  }

  function getReviewServiceLabel(row) {
    if (row.product_id && typeof getProductById === "function") {
      const product = getProductById(row.product_id);
      if (product?.title) return product.title;
    }
    return row.product_name || "（サービス未紐づけ）";
  }

  function resolveProductName(productId) {
    if (!productId) return null;
    const list = typeof getAllProducts === "function" ? getAllProducts() : PRODUCTS || [];
    return list.find((p) => p.id === productId)?.title || null;
  }

  function getAverageRating(row) {
    const values = Object.keys(RATING_LABELS).map((key) => Number(row[key] || 0));
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function getReviewExcerpt(row, maxLen) {
    const text = getBodyFieldValue(row, "body_pros").trim();
    if (!text) return "（本文なし）";
    if (!maxLen) return text;
    const chars = [...text];
    if (chars.length <= maxLen) return text;
    return `${chars.slice(0, maxLen).join("")}…`;
  }

  function filterReviews(rows) {
    let result = rows;
    if (categoryFilter !== "all") {
      result = result.filter((row) => getReviewCategory(row) === categoryFilter);
    }
    if (serviceFilter !== "all") {
      result = result.filter((row) => getReviewServiceKey(row) === serviceFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) => {
        const cat =
          typeof getCategoryLabel === "function"
            ? getCategoryLabel(getReviewCategory(row))
            : getReviewCategory(row);
        return (
          row.product_name.toLowerCase().includes(q) ||
          row.reviewer_display_name.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q) ||
          getReviewExcerpt(row, 500).toLowerCase().includes(q)
        );
      });
    }
    return result;
  }

  function buildServiceFilterOptions(allRows) {
    const baseRows =
      categoryFilter === "all"
        ? allRows
        : allRows.filter((row) => getReviewCategory(row) === categoryFilter);

    const map = new Map();
    baseRows.forEach((row) => {
      const key = getReviewServiceKey(row);
      const label = getReviewServiceLabel(row);
      if (!map.has(key)) map.set(key, { label, count: 0 });
      map.get(key).count += 1;
    });

    return Array.from(map.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label, "ja"))
      .map(([key, info]) => ({ key, ...info }));
  }

  function isReviewPublished(row) {
    return window.ReviewsApi?.isReviewPublished?.(row) ?? row?.is_published !== false;
  }

  function isReviewHidden(row) {
    return row.status === "approved" && !isReviewPublished(row);
  }

  function getReviewDisplayStatus(row) {
    if (isReviewHidden(row)) return "hidden";
    return row.status;
  }

  function statusPill(row) {
    const display = getReviewDisplayStatus(row);
    const label = ReviewsApi.statusLabel(row.status, row);
    return `<span class="adm-status-pill adm-status-pill--${display}">${App.escapeHtml(label)}</span>`;
  }

  function syncReviewUrl() {
    const url = new URL(window.location.href);
    if (currentTab !== "all") url.searchParams.set("tab", currentTab);
    else url.searchParams.delete("tab");
    if (selectedReviewId) url.searchParams.set("review", selectedReviewId);
    else url.searchParams.delete("review");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function invalidateKpiCache() {
    kpiCache = null;
  }

  async function ensureKpiCache() {
    if (kpiCache) return kpiCache;
    try {
      const [pending, approved, rejected] = await Promise.all([
        ReviewsApi.getPendingReviews(),
        ReviewsApi.getReviewHistory("approved"),
        ReviewsApi.getReviewHistory("rejected"),
      ]);
      const staticCount = getStaticReviewsForAdmin().length;
      const all = [...pending, ...approved, ...rejected, ...getStaticReviewsForAdmin()];
      const avg =
        all.length > 0
          ? (all.reduce((sum, r) => sum + getAverageRating(r), 0) / all.length).toFixed(1)
          : "—";
      kpiCache = {
        pending: pending.length,
        approved: approved.length + staticCount,
        rejected: rejected.length,
        total: pending.length + approved.length + rejected.length + staticCount,
        avg,
      };
    } catch {
      kpiCache = {
        pending: AdminPendingCount?.getCachedCount?.() || 0,
        approved: "—",
        rejected: "—",
        total: allTabRows.length || "—",
        avg: "—",
      };
    }
    return kpiCache;
  }

  function renderKpiRow(kpis) {
    const cards = [
      { key: "pending", label: "審査待ち", highlight: true },
      { key: "approved", label: "公開済み" },
      { key: "rejected", label: "却下" },
      { key: "total", label: "総口コミ数" },
      { key: "avg", label: "平均評価" },
    ];
    return `<div class="adm-kpi-row">${cards
      .map((c) => {
        const val = kpis[c.key];
        const delta =
          c.key === "pending" && Number(val) > 0
            ? `<div class="adm-kpi-delta is-down">要対応</div>`
            : `<div class="adm-kpi-delta is-neutral">—</div>`;
        const highlight = c.highlight && Number(val) > 0 ? " adm-kpi-card--alert" : "";
        return `<div class="adm-kpi-card${highlight}">
          <div class="adm-kpi-label">${c.label}</div>
          <div class="adm-kpi-value">${App.escapeHtml(String(val))}</div>
          ${delta}
        </div>`;
      })
      .join("")}</div>`;
  }

  function renderReviewTable(allRows, filtered) {
    const S = window.AdminDashboardStats;
    const serviceOptions = buildServiceFilterOptions(allRows);

    const catCounts = new Map();
    allRows.forEach((row) => {
      const cat = getReviewCategory(row);
      catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    });

    const statusChips = [
      { id: "all", label: "すべて" },
      { id: "pending", label: "審査待ち" },
      { id: "read_unlock", label: "閲覧解除待ち" },
      { id: "approved", label: "公開済み" },
      { id: "hidden", label: "非表示" },
      { id: "rejected", label: "却下" },
    ]
      .map(
        (t) =>
          `<button type="button" class="adm-chip ${currentTab === t.id ? "active" : ""}" data-status-tab="${t.id}">${t.label}</button>`
      )
      .join("");

    const catChips =
      typeof CATEGORIES !== "undefined"
        ? CATEGORIES.map((c) => {
            const count = catCounts.get(c.value) || 0;
            if (!count && categoryFilter !== c.value) return "";
            return `<button type="button" class="adm-chip ${categoryFilter === c.value ? "active" : ""}" data-review-category="${c.value}">${App.escapeHtml(c.label)} (${count})</button>`;
          }).join("")
        : "";

    const serviceSelect = [
      `<option value="all">すべてのサービス</option>`,
      ...serviceOptions.map(
        (s) =>
          `<option value="${App.escapeHtml(s.key)}" ${serviceFilter === s.key ? "selected" : ""}>${App.escapeHtml(s.label)} (${s.count})</option>`
      ),
    ].join("");

    const rows = filtered.length
      ? filtered
          .map((row) => {
            const rating = getAverageRating(row);
            const categoryLabel =
              typeof getCategoryLabel === "function"
                ? getCategoryLabel(getReviewCategory(row))
                : getReviewCategory(row);
            const dateStr = formatDateJa(row.created_at.split("T")[0]);
            const proofIcon = row._isStatic
              ? "—"
              : !row.purchase_proof_path
                ? '<span class="adm-proof-no" title="未提出">—</span>'
                : isPurchaseProofShownPublicly(row)
                  ? '<span class="adm-proof-yes" title="公開: 購入証明あり">✓</span>'
                  : '<span class="adm-proof-held" title="ファイルあり・公開はなし">△</span>';

            return `<tr class="adm-table-row-clickable" data-open-review="${App.escapeHtml(String(row.id))}" tabindex="0">
              <td>
                <div class="adm-table-name">${App.escapeHtml(row.product_name)}</div>
                <div class="adm-table-sub adm-table-excerpt">${App.escapeHtml(getReviewExcerpt(row))}</div>
              </td>
              <td>${App.escapeHtml(row.reviewer_display_name)}</td>
              <td><span class="adm-cat-pill">${App.escapeHtml(categoryLabel)}</span></td>
              <td>${S.renderStars(rating)} <span style="color:#6b7280;font-size:0.75rem">${rating.toFixed(1)}</span></td>
              <td>${statusPill(row)}${row.read_unlock_status === "pending" ? ` ${readUnlockPill(row)}` : ""}</td>
              <td>${proofIcon}</td>
              <td style="white-space:nowrap;color:#9ca3af;font-size:0.75rem">${dateStr}</td>
              <td>
                <button type="button" class="adm-action-btn" data-open-review="${App.escapeHtml(String(row.id))}" title="詳細を見る">→</button>
              </td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="8" class="adm-empty-state">該当する口コミがありません</td></tr>`;

    return `
      <div class="adm-panel">
        <div class="adm-toolbar">
          ${statusChips}
          <span style="width:1px;height:1.25rem;background:#e5e7eb;margin:0 0.25rem"></span>
          <button type="button" class="adm-chip ${categoryFilter === "all" ? "active" : ""}" data-review-category="all">全ジャンル</button>
          ${catChips}
        </div>
        <div class="adm-toolbar adm-toolbar--secondary">
          <label class="adm-toolbar-label">サービス</label>
          <select id="ar-service-filter" class="adm-select-sm adm-service-filter-dash">${serviceSelect}</select>
        </div>
        <div class="adm-table-wrap">
          <table class="adm-table adm-table--reviews">
            <thead>
              <tr>
                <th>サービス / 概要</th>
                <th>投稿者</th>
                <th>ジャンル</th>
                <th>評価</th>
                <th>状態</th>
                <th>証明</th>
                <th>投稿日</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="adm-table-foot">表示 ${filtered.length}件 / タブ内 ${allRows.length}件</div>
      </div>`;
  }

  function renderRatings(row) {
    return Object.entries(RATING_LABELS)
      .map(
        ([key, label]) =>
          `<div class="admin-rating-item">${label}: <strong>${row[key] ?? "—"}</strong></div>`
      )
      .join("");
  }

  function productOptions(selectedId) {
    const list = typeof getAllProducts === "function" ? getAllProducts() : PRODUCTS || [];
    return list
      .map(
        (p) =>
          `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${App.escapeHtml(p.title)}</option>`
      )
      .join("");
  }

  function readUnlockPill(row) {
    if (row._isStatic || !row.read_unlock_status) return "";
    const label =
      window.ReviewQuality?.readUnlockLabel?.(row.read_unlock_status) || row.read_unlock_status;
    const cls =
      row.read_unlock_status === "pending"
        ? "read-unlock-pending"
        : row.read_unlock_status === "denied"
          ? "rejected"
          : "read-unlock-ok";
    return `<span class="adm-status-pill adm-status-pill--${cls}">${App.escapeHtml(label)}</span>`;
  }

  function getLiveQualityAssessment(row) {
    if (row._isStatic || !window.ReviewQuality?.evaluateReviewRow) return null;
    return window.ReviewQuality.evaluateReviewRow(row);
  }

  function renderQualityFlags(row, liveQuality) {
    const stored = Array.isArray(row.quality_flags) ? row.quality_flags : [];
    const live = liveQuality && !liveQuality.pass ? liveQuality.reasons || [] : [];
    const flags = live.length ? live : stored;
    if (!flags.length) return "";

    const mismatch =
      liveQuality &&
      !liveQuality.pass &&
      row.read_unlock_status &&
      row.read_unlock_status !== "pending" &&
      row.read_unlock_status !== "denied";

    return `
      <div class="adm-quality-flags${mismatch ? " adm-quality-flags--alert" : ""}">
        <h4 class="adm-detail-section-title">自動品質チェック${live.length ? "（再判定）" : ""}</h4>
        ${
          mismatch
            ? `<p class="adm-quality-mismatch">品質チェックに引っかかっていますが、閲覧解除状態が「${App.escapeHtml(window.ReviewQuality.readUnlockLabel(row.read_unlock_status))}」になっています。</p>`
            : ""
        }
        <ul class="adm-quality-flags-list">
          ${flags
            .map((f) => `<li>${App.escapeHtml(f.message || f.code || "要確認")}</li>`)
            .join("")}
        </ul>
      </div>`;
  }

  function getReviewActionFlags(row) {
    const isPending = row.status === "pending";
    const isApproved = row.status === "approved";
    const canEdit = !row._isStatic && !isPending;
    const liveQuality = getLiveQualityAssessment(row);
    const needsReadUnlock = !row._isStatic && row.read_unlock_status === "pending";
    const shouldHoldReadUnlock =
      !row._isStatic &&
      liveQuality &&
      !liveQuality.pass &&
      row.read_unlock_status &&
      row.read_unlock_status !== "pending" &&
      row.read_unlock_status !== "denied";
    return {
      showActions: isPending && !row._isStatic,
      showEditActions: canEdit,
      showReadUnlockApprove: needsReadUnlock,
      showReadUnlockHold: shouldHoldReadUnlock,
      liveQuality,
      showHide: !row._isStatic && isApproved && isReviewPublished(row),
      showUnhide: !row._isStatic && isReviewHidden(row),
      showDelete: !row._isStatic && isApproved,
    };
  }

  function renderBodyReadOnly(row) {
    return EDITABLE_BODY_FIELDS.map((field) => {
      const value = getBodyFieldValue(row, field.key);
      if (field.optional && !value) return "";
      return `
        <h3 class="admin-section-title">${field.label}</h3>
        <div class="admin-text-block">${App.escapeHtml(value || "（未入力）")}</div>`;
    }).join("");
  }

  function renderBodyEditors(row, { postPublish = false } = {}) {
    const note = postPublish
      ? "公開済みの口コミを運営が修正できます。保存するとサイトに反映され、修正記録が残ります。"
      : "不適切な表現がある場合は、内容を修正してから公開してください。修正した箇所は記録されます。";
    return `
      <div class="admin-edit-note"><p>${note}</p></div>
      ${EDITABLE_BODY_FIELDS.map((field) => {
        const value = getBodyFieldValue(row, field.key);
        const minLabel = field.optional ? "任意" : `最低${field.minChars}文字`;
        return `
          <div class="admin-field admin-field--body">
            <label for="edit-${field.key}-${row.id}">${field.label} <span class="admin-field-min">${minLabel}</span></label>
            <textarea id="edit-${field.key}-${row.id}" class="form-textarea admin-edit-textarea" rows="${field.rows || 4}" data-min-chars="${field.minChars || 0}" data-optional="${field.optional ? "true" : "false"}">${App.escapeHtml(value)}</textarea>
            <p class="admin-char-hint" id="hint-${field.key}-${row.id}">${countAdminChars(value)}文字</p>
          </div>`;
      }).join("")}`;
  }

  function renderReviewDetail(row, flags, liveQuality) {
    const isStatic = row._isStatic === true;
    const categoryLabel =
      typeof getCategoryLabel === "function"
        ? getCategoryLabel(getReviewCategory(row))
        : getReviewCategory(row);
    const showEditors = flags.showActions || flags.showEditActions;
    const editedBadge = row.was_edited_by_admin
      ? '<span class="admin-edited-badge">運営が内容を修正済み</span>'
      : "";

    return `
      <div class="adm-review-detail">
        <div class="adm-detail-nav">
          <button type="button" class="adm-btn-ghost admin-back-btn" data-action="back-to-list">← 一覧に戻る</button>
          <div class="adm-detail-nav-meta">${statusPill(row)} ${readUnlockPill(row)} ${editedBadge}</div>
        </div>
        <div class="adm-panel adm-review-detail-panel">
          <div class="adm-panel-head">
            <div>
              <h3 class="adm-panel-title">${App.escapeHtml(row.product_name)}</h3>
              <p class="adm-page-sub" style="margin:0.25rem 0 0">
                ${App.escapeHtml(row.reviewer_display_name)} · 投稿 ${formatDateJa(row.created_at.split("T")[0])}
                · 購入 ${Number(row.purchase_price).toLocaleString()}円（${formatPeriod(row)}）
                · ${App.escapeHtml(categoryLabel)}
                ${row.seller_name ? ` · ${App.escapeHtml(row.seller_name)}` : ""}
                ${row.has_refund_guarantee ? ` · 返金保証: ${App.escapeHtml(refundGuaranteeLabel(row.has_refund_guarantee))}` : ""}
              </p>
            </div>
          </div>
          <div class="adm-panel-body adm-review-detail-body">
            <h4 class="adm-detail-section-title">評価</h4>
            <div class="admin-ratings">${renderRatings(row)}</div>

            ${renderQualityFlags(row, liveQuality)}

            <h4 class="adm-detail-section-title">口コミ本文</h4>
            ${showEditors ? renderBodyEditors(row, { postPublish: flags.showEditActions }) : renderBodyReadOnly(row)}

            ${renderPurchaseProofAdminMeta(row)}

            ${row.rejection_reason ? `<p class="adm-warning-inline">却下理由: ${App.escapeHtml(row.rejection_reason)}</p>` : ""}

            ${
              isStatic
                ? `<p class="admin-card-meta">デモ用の静的口コミです。${row.product_id ? `<a href="review-detail.html?id=${encodeURIComponent(row.product_id)}" target="_blank" rel="noopener">サービスページで見る</a>` : ""}</p>`
                : ""
            }

            ${
              flags.showActions
                ? `
              <div class="adm-review-actions">
                <div class="admin-field">
                  <label for="product-${row.id}">掲載先サービス</label>
                  <select id="product-${row.id}" class="form-input adm-input-full">
                    <option value="">— 未紐づけ —</option>
                    ${productOptions(row.product_id)}
                  </select>
                </div>
                <div class="admin-field">
                  <label for="note-${row.id}">運営メモ（非公開）</label>
                  <textarea id="note-${row.id}" class="form-textarea adm-input-full" rows="2">${App.escapeHtml(row.admin_note || "")}</textarea>
                </div>
                ${renderPurchaseProofDisplayField(row)}
                <div class="admin-field">
                  <label for="reject-${row.id}">却下理由</label>
                  <textarea id="reject-${row.id}" class="form-textarea adm-input-full" rows="2" placeholder="掲載基準に適合しない場合の理由"></textarea>
                </div>
                <div class="admin-actions">
                  <button type="button" class="adm-btn-primary" data-action="approve" data-id="${row.id}">修正内容を確認して公開</button>
                  <button type="button" class="adm-btn-ghost" data-action="reject" data-id="${row.id}">却下</button>
                </div>
              </div>`
                : ""
            }

            ${
              flags.showEditActions
                ? `
              <div class="adm-review-actions">
                <div class="admin-field">
                  <label for="product-${row.id}">掲載先サービス</label>
                  <select id="product-${row.id}" class="form-input adm-input-full">
                    <option value="">— 未紐づけ —</option>
                    ${productOptions(row.product_id)}
                  </select>
                </div>
                <div class="admin-field">
                  <label for="note-${row.id}">運営メモ（非公開）</label>
                  <textarea id="note-${row.id}" class="form-textarea adm-input-full" rows="2">${App.escapeHtml(row.admin_note || "")}</textarea>
                </div>
                ${renderPurchaseProofDisplayField(row)}
                <div class="admin-actions">
                  <button type="button" class="adm-btn-primary" data-action="save-review" data-id="${row.id}">変更を保存</button>
                </div>
              </div>`
                : ""
            }

            ${
              flags.showReadUnlockApprove
                ? `
              <div class="adm-review-actions adm-review-actions--read-unlock">
                <p class="adm-read-unlock-note">この投稿者はまだ他の口コミ全文を閲覧できません。内容を確認し、問題なければ閲覧解除を承認してください（サイト公開とは別の操作です）。</p>
                <div class="admin-actions">
                  <button type="button" class="adm-btn-primary" data-action="approve-read-unlock" data-id="${row.id}">閲覧解除を承認</button>
                </div>
              </div>`
                : ""
            }

            ${
              flags.showReadUnlockHold
                ? `
              <div class="adm-review-actions adm-review-actions--read-unlock">
                <p class="adm-read-unlock-note">自動判定では不適切な内容ですが、閲覧解除済みの状態になっています。モザイクを維持する場合は「閲覧解除待ちに戻す」を押してください。</p>
                <div class="admin-actions">
                  <button type="button" class="adm-btn-ghost" data-action="hold-read-unlock" data-id="${row.id}">閲覧解除待ちに戻す</button>
                </div>
              </div>`
                : ""
            }

            ${
              flags.showHide || flags.showUnhide || flags.showDelete
                ? `<div class="admin-actions admin-actions--delete">
                  ${
                    flags.showHide
                      ? `<button type="button" class="adm-btn-ghost" data-action="hide-review" data-id="${row.id}">サイトで非表示</button>`
                      : ""
                  }
                  ${
                    flags.showUnhide
                      ? `<button type="button" class="adm-btn-primary" data-action="unhide-review" data-id="${row.id}">再表示する</button>`
                      : ""
                  }
                  ${
                    flags.showDelete
                      ? `<button type="button" class="adm-btn-ghost adm-btn-danger" data-action="delete-review" data-id="${row.id}">完全に削除</button>`
                      : ""
                  }
                </div>`
                : ""
            }
          </div>
        </div>
      </div>`;
  }

  function collectShowPurchaseProof(reviewId) {
    const row = editableRowsById.get(reviewId);
    if (!row?.purchase_proof_path) return false;
    const checked = document.querySelector(`input[name="show-purchase-proof-${reviewId}"]:checked`);
    return checked?.value === "yes";
  }

  function collectEditedContent(reviewId) {
    const content = {};
    EDITABLE_BODY_FIELDS.forEach((field) => {
      const el = document.getElementById(`edit-${field.key}-${reviewId}`);
      content[field.key] = el?.value.trim() || "";
    });
    return content;
  }

  function wasContentEdited(row, content) {
    return EDITABLE_BODY_FIELDS.some((field) => {
      const original = getBodyFieldValue(row, field.key).trim();
      return (content[field.key] || "").trim() !== original;
    });
  }

  function bindEditorHints() {
    EDITABLE_BODY_FIELDS.forEach((field) => {
      document.querySelectorAll(`[id^="edit-${field.key}-"]`).forEach((textarea) => {
        const hint = document.getElementById(
          `hint-${field.key}-${textarea.id.replace(`edit-${field.key}-`, "")}`
        );
        const update = () => {
          const len = countAdminChars(textarea.value);
          const min = Number(textarea.dataset.minChars || 0);
          const optional = textarea.dataset.optional === "true";
          if (!hint) return;
          if (optional) {
            hint.textContent = `${len}文字（任意）`;
            hint.classList.remove("is-invalid", "is-valid");
          } else {
            const remaining = Math.max(0, min - len);
            hint.textContent =
              remaining > 0
                ? `${len} / ${min}文字（あと${remaining}文字）`
                : `${len} / ${min}文字（達成済み）`;
            hint.classList.toggle("is-invalid", remaining > 0);
            hint.classList.toggle("is-valid", remaining === 0);
          }
        };
        textarea.addEventListener("input", update);
        update();
      });
    });
  }

  async function fetchReviewsForTab(tab) {
    let rows = [];
    if (tab === "all") {
      rows = await ReviewsApi.getAllReviewsAdmin();
      rows = [...rows, ...getStaticReviewsForAdmin()];
    } else if (tab === "pending") {
      rows = await ReviewsApi.getPendingReviews();
    } else if (tab === "read_unlock") {
      rows = await ReviewsApi.getReadUnlockPendingReviews();
    } else if (tab === "approved") {
      rows = (await ReviewsApi.getReviewHistory("approved")).filter((r) => isReviewPublished(r));
      rows = [...rows, ...getStaticReviewsForAdmin()];
    } else if (tab === "hidden") {
      rows = (await ReviewsApi.getReviewHistory("approved")).filter((r) => isReviewHidden(r));
    } else {
      rows = await ReviewsApi.getReviewHistory("rejected");
    }
    return annotateReviewRows(rows);
  }

  function openReviewDetail(id) {
    const row = listRows.find((r) => String(r.id) === String(id));
    if (!row) return;
    selectedReviewId = row.id;
    syncReviewUrl();
    paintContent();
    contentRoot?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeReviewDetail() {
    selectedReviewId = null;
    syncReviewUrl();
    paintContent();
  }

  function paintContent() {
    if (!contentRoot) return;

    editableRowsById.clear();
    listRows.filter((r) => !r._isStatic).forEach((r) => editableRowsById.set(r.id, r));

    if (selectedReviewId) {
      const row = listRows.find((r) => String(r.id) === String(selectedReviewId));
      if (!row) {
        selectedReviewId = null;
        syncReviewUrl();
        paintContent();
        return;
      }
      const flags = getReviewActionFlags(row);
      contentRoot.innerHTML = renderReviewDetail(row, flags, flags.liveQuality);
      bindEvents(contentRoot);
      bindEditorHints();
      return;
    }

    contentRoot.innerHTML = `
      <div id="ar-kpi-slot"></div>
      ${renderReviewTable(allTabRows, listRows)}`;

    ensureKpiCache().then((kpis) => {
      const slot = document.getElementById("ar-kpi-slot");
      if (slot) slot.innerHTML = renderKpiRow(kpis);
    });

    bindEvents(contentRoot);
  }

  function bindEvents(root) {
    root.querySelectorAll("[data-open-review]").forEach((el) => {
      const open = (e) => {
        if (el.tagName === "TR" && e.target.closest("button")) return;
        openReviewDetail(el.dataset.openReview);
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openReviewDetail(el.dataset.openReview);
        }
      });
    });

    root.querySelectorAll("[data-action='back-to-list']").forEach((btn) => {
      btn.addEventListener("click", closeReviewDetail);
    });

    root.querySelectorAll("[data-status-tab]").forEach((btn) => {
      btn.addEventListener("click", () => loadTab(btn.dataset.statusTab));
    });

    root.querySelectorAll("[data-review-category]").forEach((btn) => {
      btn.addEventListener("click", () => {
        categoryFilter = btn.dataset.reviewCategory || "all";
        serviceFilter = "all";
        selectedReviewId = null;
        syncReviewUrl();
        reloadCurrentTab();
      });
    });

    document.getElementById("ar-service-filter")?.addEventListener("change", (e) => {
      serviceFilter = e.target.value || "all";
      selectedReviewId = null;
      syncReviewUrl();
      reloadCurrentTab();
    });

    root.querySelectorAll("[data-proof-path]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const url = await ReviewsApi.getProofSignedUrl(btn.dataset.proofPath);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        } catch (err) {
          App.showToast(err.message, "error");
        }
      });
    });

    root.querySelectorAll("[data-action='approve']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          const productId = document.getElementById(`product-${id}`)?.value || null;
          const adminNote = document.getElementById(`note-${id}`)?.value.trim() || "";
          const content = collectEditedContent(id);
          const row = editableRowsById.get(id);
          const edited = row ? wasContentEdited(row, content) : false;
          await ReviewsApi.approveReview(id, {
            productId: productId || undefined,
            productName: resolveProductName(productId) || undefined,
            adminNote,
            content,
            wasEdited: edited,
            showPurchaseProof: collectShowPurchaseProof(id),
          });
          App.showToast(edited ? "内容を修正して公開しました" : "口コミを公開しました");
          invalidateKpiCache();
          selectedReviewId = null;
          await loadTab("pending");
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='save-review']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          const productId = document.getElementById(`product-${id}`)?.value || null;
          const adminNote = document.getElementById(`note-${id}`)?.value.trim() || "";
          const content = collectEditedContent(id);
          const row = editableRowsById.get(id);
          const edited = row ? wasContentEdited(row, content) : true;
          const productChanged = row && productId !== (row.product_id || "");
          await ReviewsApi.updateReviewAdmin(id, {
            productId,
            productName: resolveProductName(productId) || row?.product_name || undefined,
            adminNote,
            content,
            wasEdited: edited || productChanged,
            showPurchaseProof: collectShowPurchaseProof(id),
          });
          App.showToast("口コミを更新しました");
          invalidateKpiCache();
          await loadTab(currentTab, { preserveSelection: true });
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='hold-read-unlock']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const row = editableRowsById.get(id) || listRows.find((r) => String(r.id) === String(id));
        const liveQuality = row ? getLiveQualityAssessment(row) : null;
        btn.disabled = true;
        try {
          await ReviewsApi.resetReadUnlockPending(id, liveQuality?.reasons);
          App.showToast("閲覧解除を待ち状態に戻しました");
          invalidateKpiCache();
          await loadTab(currentTab, { preserveSelection: true });
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='approve-read-unlock']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          await ReviewsApi.approveReadUnlock(id);
          App.showToast("閲覧解除を承認しました");
          invalidateKpiCache();
          await loadTab(currentTab === "read_unlock" ? "read_unlock" : currentTab, {
            preserveSelection: false,
          });
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='reject']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const reason = document.getElementById(`reject-${id}`)?.value.trim();
        if (!reason) {
          App.showToast("却下理由を入力してください", "error");
          return;
        }
        btn.disabled = true;
        try {
          const adminNote = document.getElementById(`note-${id}`)?.value.trim() || "";
          await ReviewsApi.rejectReview(id, reason, adminNote);
          App.showToast("口コミを却下しました");
          invalidateKpiCache();
          selectedReviewId = null;
          await loadTab("pending");
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='hide-review']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!window.confirm("この口コミをサイトで非表示にしますか？\nデータは残り、運営画面から再表示できます。")) return;
        btn.disabled = true;
        try {
          await ReviewsApi.setReviewPublished(id, false);
          App.showToast("口コミを非表示にしました");
          invalidateKpiCache();
          selectedReviewId = null;
          await loadTab("hidden");
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='unhide-review']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          await ReviewsApi.setReviewPublished(id, true);
          App.showToast("口コミを再表示しました");
          invalidateKpiCache();
          selectedReviewId = null;
          await loadTab("approved");
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='delete-review']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!window.confirm("この口コミを完全に削除しますか？\n非表示とは異なり、データごと消え元に戻せません。")) return;
        btn.disabled = true;
        try {
          await ReviewsApi.deleteApprovedReview(id);
          App.showToast("口コミを削除しました");
          invalidateKpiCache();
          selectedReviewId = null;
          await loadTab(currentTab);
        } catch (err) {
          App.showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    });
  }

  async function reloadCurrentTab() {
    listRows = filterReviews(allTabRows);
    paintContent();
  }

  async function loadTab(tab, { preserveSelection = false } = {}) {
    currentTab = tab;
    if (!preserveSelection) {
      selectedReviewId = null;
    }
    syncReviewUrl();

    if (contentRoot) {
      contentRoot.innerHTML = `<div class="adm-empty-state">読み込み中...</div>`;
    }

    try {
      allTabRows = await fetchReviewsForTab(tab);
      const serviceOptions = buildServiceFilterOptions(allTabRows);
      if (serviceFilter !== "all" && !serviceOptions.some((s) => s.key === serviceFilter)) {
        serviceFilter = "all";
        selectedReviewId = null;
      }
      listRows = filterReviews(allTabRows);

      if (
        selectedReviewId &&
        !listRows.some((row) => String(row.id) === String(selectedReviewId))
      ) {
        selectedReviewId = null;
      }

      syncReviewUrl();
      paintContent();
      await AdminPendingCount?.refresh?.();
    } catch (err) {
      if (contentRoot) {
        contentRoot.innerHTML = `<div class="adm-empty-state">${App.escapeHtml(err.message)}</div>`;
      }
    }
  }

  async function render(root, { tab = "all", reviewId = null } = {}) {
    contentRoot = root;
    currentTab = tab;
    selectedReviewId = reviewId;
    await loadTab(tab, { preserveSelection: Boolean(reviewId) });
  }

  function setSearchQuery(q) {
    searchQuery = q;
    if (contentRoot && !selectedReviewId) {
      listRows = filterReviews(allTabRows);
      paintContent();
    }
  }

  window.AdminReviews = { render, setSearchQuery, loadTab };
})();
