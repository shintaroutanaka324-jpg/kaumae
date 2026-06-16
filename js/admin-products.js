(function () {
  const EMPTY_FORM = {
    title: "",
    instructor: "",
    category: "other",
    price: 0,
    platform: "",
    imageUrl: "",
    description: "",
    highlightPro: "",
    highlightCon: "",
    officialUrl: "",
    isPublished: true,
  };

  let categoryFilter = "all";
  let searchQuery = "";
  let editingId = null;
  let editingIsStatic = false;
  let contentRoot = null;
  let cachedProducts = [];

  const FORM_EXAMPLE = {
    title: "山本のWebマーケティング実践講座",
    instructor: "山本",
    category: "web-marketing",
    platform: "オンライン講座",
    imageUrl: "",
    description:
      "SNSやLPの基礎から集客の流れまで学べる、実践型のマーケティング講座です。購入前に口コミで雰囲気を確認できます。",
    officialUrl: "https://example.com/yamamoto-course",
  };

  const FORM_EXAMPLE_ITEMS = [
    { id: "ap-title", key: "title" },
    { id: "ap-instructor", key: "instructor" },
    { id: "ap-category", key: "category" },
    { id: "ap-platform", key: "platform" },
    { id: "ap-description", key: "description" },
    { id: "ap-official", key: "officialUrl", optional: true },
  ];

  function categoryOptions(selected) {
    if (typeof CATEGORIES === "undefined") return "";
    return CATEGORIES.map(
      (c) =>
        `<option value="${c.value}" ${c.value === selected ? "selected" : ""}>${App.escapeHtml(c.label)}</option>`
    ).join("");
  }

  function productToForm(product) {
    return {
      title: product.title || "",
      instructor: product.instructor || "",
      category: product.category || "other",
      price: product.price ?? "",
      platform: product.platform || "",
      imageUrl: product.imageUrl || "",
      description: product.description || "",
      highlightPro: product.highlightPro || "",
      highlightCon: product.highlightCon || "",
      officialUrl: product.officialUrl || "",
      isPublished: product.isPublished !== false,
    };
  }

  function staticProductToInput(product, overrides = {}) {
    return {
      id: product.id,
      title: product.title,
      instructor: product.instructor,
      category: product.category,
      price: product.price,
      platform: product.platform,
      imageUrl: product.imageUrl,
      description: product.description,
      highlightPro: product.highlightPro,
      highlightCon: product.highlightCon,
      officialUrl: product.officialUrl,
      supportPeriod: product.supportPeriod,
      refundPolicy: product.refundPolicy,
      companyName: product.companyName,
      location: product.location,
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
      proofRate: product.proofRate,
      isPublished: product.isPublished !== false,
      ...overrides,
    };
  }

  function isProductPublished(product) {
    if (product.source === "static") return true;
    return product.isPublished !== false;
  }

  function filterProducts(products) {
    let result = products;
    if (categoryFilter !== "all") result = result.filter((p) => p.category === categoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => {
        const cat = typeof getCategoryLabel === "function" ? getCategoryLabel(p.category) : p.category;
        return (
          p.title.toLowerCase().includes(q) ||
          p.instructor.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q) ||
          String(p.id).toLowerCase().includes(q)
        );
      });
    }
    return result;
  }

  function renderKpiRow(kpis) {
    const cards = [
      { key: "services", label: "登録サービス数" },
      { key: "reviews", label: "口コミ数" },
      { key: "users", label: "ユーザー数" },
      { key: "monthlyPv", label: "月間PV" },
      { key: "avgRating", label: "平均評価" },
    ];
    return `<div class="adm-kpi-row">${cards
      .map((c) => {
        const k = kpis[c.key];
        return `<div class="adm-kpi-card">
          <div class="adm-kpi-label">${c.label}</div>
          <div class="adm-kpi-value">${App.escapeHtml(String(k.value))}</div>
          <div class="adm-kpi-delta ${k.delta.cls}">${App.escapeHtml(k.delta.text)}</div>
        </div>`;
      })
      .join("")}</div>`;
  }

  function renderServiceTable(products, pvStats = {}) {
    const filtered = filterProducts(products);
    const S = window.AdminDashboardStats;

    const rows = filtered.length
      ? filtered
          .map((p) => {
            const published = isProductPublished(p);
            const pvInfo = S.getProductPvStats(pvStats, p.id);
            const pv = pvInfo.monthlyPv || 0;
            const rating = p.averageRating || 0;
            const reviews = p.reviewCount || 0;
            const regDate = p.created_at
              ? new Date(p.created_at).toLocaleDateString("ja-JP")
              : p.source === "static"
                ? "—"
                : "—";
            const toggleTitle = published
              ? "公開中（クリックで非公開）"
              : "非公開（クリックで公開）";

            return `<tr data-product-id="${App.escapeHtml(p.id)}">
              <td>
                <div class="adm-table-service">
                  <img class="adm-table-thumb" src="${App.escapeHtml(p.imageUrl || ProductsApi?.DEFAULT_IMAGE || "")}" alt="" loading="lazy" />
                  <div>
                    <div class="adm-table-name adm-table-provider">${App.escapeHtml(p.instructor || p.companyName || "—")}${p.source === "static" ? '<span class="adm-table-tag">デモ</span>' : ""}</div>
                  </div>
                </div>
              </td>
              <td><span class="adm-cat-pill">${App.escapeHtml(getCategoryLabel(p.category))}</span></td>
              <td>${reviews}</td>
              <td>${S.renderStars(rating)} <span style="color:#6b7280;font-size:0.75rem">${rating ? rating.toFixed(1) : "—"}</span></td>
              <td><div class="adm-pv-cell">${pv.toLocaleString("ja-JP")}${S.sparklineFromDaily(pvInfo.last8Days)}</div></td>
              <td>
                <button type="button" class="adm-toggle ${published ? "is-on" : ""}" data-action="toggle-product" data-id="${App.escapeHtml(p.id)}" data-static="${p.source === "static" ? "1" : "0"}" data-published="${published}" aria-label="${toggleTitle}" title="${toggleTitle}"></button>
              </td>
              <td style="white-space:nowrap;color:#9ca3af;font-size:0.75rem">${regDate}</td>
              <td>
                <div class="adm-row-actions">
                  <a href="review-detail.html?id=${encodeURIComponent(p.id)}" class="adm-action-btn" target="_blank" rel="noopener" title="プレビュー">👁</a>
                  <button type="button" class="adm-action-btn" data-action="edit-product" data-id="${App.escapeHtml(p.id)}" data-static="${p.source === "static" ? "1" : "0"}" title="編集">✎</button>
                  ${
                    p.source === "db"
                      ? `<button type="button" class="adm-action-btn is-danger" data-action="delete-product" data-id="${App.escapeHtml(p.id)}" title="削除">✕</button>`
                      : ""
                  }
                </div>
              </td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="8" class="adm-empty-state">該当するサービスがありません</td></tr>`;

    const catChips =
      typeof CATEGORIES !== "undefined"
        ? CATEGORIES.map((c) => {
            const count = products.filter((p) => p.category === c.value).length;
            if (!count && categoryFilter !== c.value) return "";
            return `<button type="button" class="adm-chip ${categoryFilter === c.value ? "active" : ""}" data-category="${c.value}">${App.escapeHtml(c.label)} (${count})</button>`;
          }).join("")
        : "";

    return `
      <div class="adm-panel">
        <div class="adm-toolbar">
          <button type="button" class="adm-chip ${categoryFilter === "all" ? "active" : ""}" data-category="all">全カテゴリ</button>
          ${catChips}
        </div>
        <div class="adm-table-wrap">
          <table class="adm-table">
            <thead>
              <tr>
                <th>提供者</th>
                <th>カテゴリ</th>
                <th>口コミ</th>
                <th>評価</th>
                <th>月間PV</th>
                <th>公開</th>
                <th>登録日</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="padding:0.65rem 1rem;font-size:0.75rem;color:#9ca3af;border-top:1px solid #f3f4f6">
          表示 ${filtered.length}件 / 全 ${products.length}件
        </div>
      </div>`;
  }

  function renderFormFields(form) {
    return `
      <div class="admin-product-grid">
        <div class="admin-field">
          <label for="ap-title">名称 *</label>
          <input type="text" id="ap-title" class="form-input" required value="${App.escapeHtml(form.title)}" />
        </div>
        <div class="admin-field">
          <label for="ap-instructor">講師・発信者名 *</label>
          <input type="text" id="ap-instructor" class="form-input" required value="${App.escapeHtml(form.instructor)}" />
        </div>
        <div class="admin-field">
          <label for="ap-category">カテゴリ *</label>
          <select id="ap-category" class="form-input">${categoryOptions(form.category)}</select>
        </div>
        <div class="admin-field">
          <label for="ap-platform">販売プラットフォーム</label>
          <input type="text" id="ap-platform" class="form-input" value="${App.escapeHtml(form.platform)}" />
        </div>
        <div class="admin-field admin-field--full">
          <label class="form-label">画像</label>
          <div class="adm-image-upload">
            <img
              id="ap-image-preview"
              class="adm-image-preview${form.imageUrl ? "" : " is-hidden"}"
              src="${form.imageUrl ? App.escapeHtml(form.imageUrl) : ""}"
              alt=""
              data-current="${App.escapeHtml(form.imageUrl || "")}"
            />
            <label class="adm-image-upload-btn" for="ap-image-file">
              <span class="adm-image-upload-title">画像を選択</span>
              <span class="adm-image-upload-hint">JPEG / PNG / WebP（5MBまで）</span>
              <span class="adm-image-upload-name" id="ap-image-name">${form.imageUrl ? "現在の画像を使用中" : "未選択"}</span>
            </label>
            <input type="file" id="ap-image-file" class="adm-image-input" accept="image/jpeg,image/png,image/webp,image/gif" />
          </div>
          <p class="form-hint">未選択の場合はサイト共通のデフォルト画像が使われます。</p>
          <input type="hidden" id="ap-image-url" value="${App.escapeHtml(form.imageUrl || "")}" />
        </div>
        <div class="admin-field admin-field--full">
          <label for="ap-description">説明</label>
          <textarea id="ap-description" class="form-textarea" rows="3">${App.escapeHtml(form.description)}</textarea>
        </div>
        <div class="admin-field admin-field--full">
          <label for="ap-official">公式URL</label>
          <input type="url" id="ap-official" class="form-input" placeholder="https://example.com" value="${App.escapeHtml(form.officialUrl)}" />
          <p class="form-hint">https:// から始まるURLを入力してください（未入力の場合、詳細ページに「公式サイトを見る」は表示されません）。</p>
        </div>
      </div>
      <label class="admin-checkbox">
        <input type="checkbox" id="ap-published" ${form.isPublished !== false ? "checked" : ""} />
        サイトに公開する
      </label>`;
  }

  function openFormModal(form = EMPTY_FORM, product = null) {
    const isEdit = Boolean(editingId);
    const modalRoot = document.getElementById("admin-modal-root");
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="adm-modal-backdrop" id="adm-modal-backdrop">
        <div class="adm-modal" role="dialog" aria-modal="true">
          <div class="adm-modal-head">
            <h2 class="adm-modal-title">${isEdit ? "編集" : "新規登録"}</h2>
            <button type="button" class="adm-modal-close" id="ap-modal-close" aria-label="閉じる">×</button>
          </div>
          <div class="adm-modal-body">
            ${editingIsStatic ? '<p class="adm-warning-banner">デモデータを編集しています。保存するとDBに登録されます。</p>' : ""}
            <form id="admin-product-form" novalidate>
              ${renderFormFields(form)}
              <div class="admin-actions" style="margin-top:1rem">
                <button type="submit" class="adm-btn-primary">${isEdit ? "変更を保存" : "追加"}</button>
                <button type="button" class="adm-btn-ghost" id="ap-cancel-edit">キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      </div>`;

    const close = () => {
      editingId = null;
      editingIsStatic = false;
      modalRoot.innerHTML = "";
    };

    document.getElementById("ap-modal-close")?.addEventListener("click", close);
    document.getElementById("ap-cancel-edit")?.addEventListener("click", close);
    document.getElementById("adm-modal-backdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "adm-modal-backdrop") close();
    });

    bindFormEvents(modalRoot, cachedProducts, close);
    bindImageUpload(modalRoot);
  }

  function bindImageUpload(root) {
    const input = root.querySelector("#ap-image-file");
    const preview = root.querySelector("#ap-image-preview");
    const nameEl = root.querySelector("#ap-image-name");
    if (!input || !preview) return;

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        const current = preview.dataset.current || "";
        preview.src = current;
        preview.classList.toggle("is-hidden", !current);
        nameEl.textContent = current ? "現在の画像を使用中" : "未選択";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        App.showToast("画像は5MB以下にしてください", "error");
        input.value = "";
        return;
      }
      nameEl.textContent = file.name;
      preview.src = URL.createObjectURL(file);
      preview.classList.remove("is-hidden");
    });
  }

  function collectFormData() {
    return {
      title: document.getElementById("ap-title")?.value.trim() || "",
      instructor: document.getElementById("ap-instructor")?.value.trim() || "",
      category: document.getElementById("ap-category")?.value || "other",
      price: 0,
      platform: document.getElementById("ap-platform")?.value.trim() || "",
      imageUrl: document.getElementById("ap-image-url")?.value.trim() || "",
      description: document.getElementById("ap-description")?.value.trim() || "",
      highlightPro: "",
      highlightCon: "",
      officialUrl:
        (typeof ProductsApi?.normalizeExternalUrl === "function"
          ? ProductsApi.normalizeExternalUrl(document.getElementById("ap-official")?.value)
          : document.getElementById("ap-official")?.value.trim()) || "",
      supportPeriod: "",
      refundPolicy: "",
      isPublished: document.getElementById("ap-published")?.checked !== false,
    };
  }

  function validateForm(data) {
    if (!data.title) return "名称を入力してください";
    if (!data.instructor) return "講師・発信者名を入力してください";
    return null;
  }

  function bindFormEvents(root, products, onClose) {
    document.getElementById("admin-product-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = collectFormData();
      const err = validateForm(data);
      if (err) {
        App.showToast(err, "error");
        return;
      }
      const submitBtn = e.target.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "保存中...";
      }
      try {
        const api = await ensureProductsApi();
        const imageFile = document.getElementById("ap-image-file")?.files?.[0] || null;
        const productId =
          editingId && !editingIsStatic ? editingId : editingId || api.generateProductId();

        if (imageFile) {
          data.imageUrl = (await api.uploadProductImage(imageFile, productId)) || data.imageUrl;
        }

        if (editingId && !editingIsStatic) {
          await api.updateProduct(editingId, data);
          App.showToast("サービスを更新しました");
        } else {
          const payload = editingId && editingIsStatic ? { ...data, id: editingId } : { ...data, id: productId };
          if (editingIsStatic) {
            const original = products.find((p) => p.id === editingId);
            if (original) {
              Object.assign(payload, {
                companyName: original.companyName,
                location: original.location,
                averageRating: original.averageRating,
                reviewCount: original.reviewCount,
                proofRate: original.proofRate,
              });
            }
          }
          await api.createProduct(payload);
          App.showToast(editingIsStatic ? "DBに登録しました" : "サービスを追加しました");
        }
        editingId = null;
        editingIsStatic = false;
        onClose?.();
        await render(contentRoot);
      } catch (error) {
        App.showToast(error.message, "error");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = editingId ? "変更を保存" : "追加";
        }
      }
    });
  }

  async function applyProductVisibility(product, publish) {
    const api = await ensureProductsApi();
    const isDb = product.source === "db" || product.isDbProduct;

    if (isDb) {
      await api.setProductPublished(product.id, publish);
      return;
    }

    const dbOverride =
      typeof getAllProductsAdmin === "function"
        ? getAllProductsAdmin().find((p) => p.id === product.id && p.isDbProduct)
        : null;

    if (dbOverride) {
      await api.setProductPublished(product.id, publish);
      return;
    }

    await api.createProduct(staticProductToInput(product, { isPublished: publish }));
  }

  function bindListEvents(root, products) {
    const openCreate = () => {
      editingId = null;
      editingIsStatic = false;
      openFormModal(EMPTY_FORM);
    };

    root.querySelectorAll("#ap-show-create-form, [id=ap-show-create-form]").forEach((btn) => {
      btn.addEventListener("click", openCreate);
    });
    document.getElementById("ap-show-create-form")?.addEventListener("click", openCreate);

    root.querySelectorAll("[data-category]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        categoryFilter = btn.dataset.category || "all";
        await render(contentRoot);
      });
    });

    root.querySelectorAll("[data-action='edit-product']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const product = products.find((p) => p.id === id);
        if (!product) return;
        editingId = id;
        editingIsStatic = btn.dataset.static === "1";
        openFormModal(productToForm(product), product);
      });
    });

    root.querySelectorAll("[data-action='toggle-product']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const product = products.find((p) => p.id === id);
        if (!product) return;
        const publish = btn.dataset.published !== "true";
        btn.disabled = true;
        try {
          await applyProductVisibility(product, publish);
          App.showToast(publish ? "公開しました" : "非公開にしました");
          await render(contentRoot);
        } catch (error) {
          App.showToast(error.message, "error");
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll("[data-action='delete-product']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!window.confirm("このサービスを削除しますか？")) return;
        btn.disabled = true;
        try {
          await (await ensureProductsApi()).deleteProduct(btn.dataset.id);
          App.showToast("削除しました");
          await render(contentRoot);
        } catch (error) {
          App.showToast(error.message, "error");
        }
      });
    });

  }

  async function ensureProductsApi() {
    await App.whenReady();
    if (window.ProductsApi) return window.ProductsApi;
    throw new Error("サービス管理の読み込みに失敗しました。");
  }

  async function fetchAdminProducts() {
    const api = await ensureProductsApi();
    let dbError = null;
    try {
      await api.loadAllProductsAdmin();
    } catch (err) {
      dbError = err;
      if (typeof setDbProductsAdmin === "function") setDbProductsAdmin([]);
    }
    const all =
      typeof getAllProductsAdmin === "function"
        ? getAllProductsAdmin()
        : typeof getAllProducts === "function"
          ? getAllProducts()
          : typeof PRODUCTS !== "undefined"
            ? PRODUCTS
            : [];
    return {
      products: all.map((p) => ({ ...p, source: p.isDbProduct ? "db" : "static" })),
      dbError,
    };
  }

  async function render(root) {
    contentRoot = root;
    root.innerHTML = `<div class="adm-empty-state">読み込み中...</div>`;
    try {
      const { products, dbError } = await fetchAdminProducts();
      cachedProducts = products;
      const pvStats = await window.AdminDashboardStats.loadPvStats();
      const kpis = await window.AdminDashboardStats.computeKpis(products, pvStats);

      let warning = "";
      if (dbError?.message?.includes("products") || dbError?.message?.includes("relation")) {
        warning = `<div class="adm-warning-banner">DB未設定: <code>schema-products.sql</code> を実行してください。</div>`;
      }

      const actionsEl = document.getElementById("adm-page-actions");
      if (actionsEl) {
        actionsEl.innerHTML = `<button type="button" class="adm-btn-primary" id="ap-show-create-form">＋ 新規登録</button>`;
      }

      root.innerHTML = `
        ${warning}
        ${renderKpiRow(kpis)}
        <div class="adm-services-main">${renderServiceTable(products, pvStats)}</div>`;

      bindListEvents(root, products);
      document.getElementById("ap-show-create-form")?.addEventListener("click", () => {
        editingId = null;
        editingIsStatic = false;
        openFormModal(EMPTY_FORM);
      });
    } catch (err) {
      root.innerHTML = `<div class="adm-empty-state">${App.escapeHtml(err.message)}</div>`;
    }
  }

  function setSearchQuery(q) {
    searchQuery = q;
    if (contentRoot) render(contentRoot);
  }

  window.AdminProducts = { render, setSearchQuery };
})();
