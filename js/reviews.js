const PER_PAGE = 10;

const RATING_FILTERS = [
  { value: "", label: "指定なし" },
  { value: "4.5", label: "★4.5以上" },
  { value: "4.0", label: "★4.0以上" },
  { value: "3.0", label: "★3.0以上" },
];

const REVIEW_COUNT_FILTERS = [
  { value: "", label: "指定なし" },
  { value: "10", label: "10件以上" },
  { value: "30", label: "30件以上" },
  { value: "50", label: "50件以上" },
];

document.addEventListener("DOMContentLoaded", async () => {
  await App.whenReady();

  const sortSelect = document.getElementById("filter-sort");
  const proofCheckbox = document.getElementById("filter-proof");
  const filterPanel = document.getElementById("rs-filter");
  const filterToggle = document.getElementById("filter-toggle");

  let currentPage = 1;
  let searchQuery = (App.getQueryParam("search") || "").trim();
  let selectedCategories = new Set();
  let selectedRating = "";
  let selectedReviewCount = "";

  function getProductEntries() {
    return getAllProducts().map((product) => ({
      product,
      stats: getProductDisplayStats(product),
    }));
  }

  renderFilterUI();
  renderPopularTags();
  renderRanking();
  renderRecentlyViewed();

  const urlCategory = App.getQueryParam("genre") || App.getQueryParam("category");
  if (urlCategory) {
    selectedCategories.add(urlCategory);
    syncCategoryCheckboxes();
  }

  function renderFilterUI() {
    const catContainer = document.getElementById("filter-categories");
    catContainer.innerHTML = FILTER_CATEGORIES.map(
      (c) => `
      <label class="rs-filter-checkbox">
        <input type="checkbox" value="${c.value}" data-filter="category" />
        <span>${App.escapeHtml(c.label)}</span>
      </label>`
    ).join("");

    document.getElementById("filter-rating").innerHTML = RATING_FILTERS.map(
      (f) => `
      <label class="rs-filter-radio">
        <input type="radio" name="rating-filter" value="${f.value}" ${f.value === "" ? "checked" : ""} />
        <span>${App.escapeHtml(f.label)}</span>
      </label>`
    ).join("");

    document.getElementById("filter-review-count").innerHTML = REVIEW_COUNT_FILTERS.map(
      (f) => `
      <label class="rs-filter-radio">
        <input type="radio" name="review-count-filter" value="${f.value}" ${f.value === "" ? "checked" : ""} />
        <span>${App.escapeHtml(f.label)}</span>
      </label>`
    ).join("");
  }

  function renderPopularTags() {
    const container = document.getElementById("popular-tags");
    container.innerHTML = `
      <span class="rs-tags-label">人気タグ</span>
      ${POPULAR_TAGS.map(
        (tag) =>
          `<button type="button" class="rs-tag" data-category="${tag.category}">${App.escapeHtml(tag.label)}</button>`
      ).join("")}
    `;

    container.querySelectorAll(".rs-tag").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.category;
        if (selectedCategories.has(cat)) {
          selectedCategories.delete(cat);
        } else {
          selectedCategories.add(cat);
        }
        syncCategoryCheckboxes();
        currentPage = 1;
        render();
        scrollToResults();
      });
    });
  }

  function syncCategoryCheckboxes() {
    document.querySelectorAll('[data-filter="category"]').forEach((input) => {
      input.checked = selectedCategories.has(input.value);
    });
    document.querySelectorAll(".rs-tag").forEach((btn) => {
      btn.classList.toggle("active", selectedCategories.has(btn.dataset.category));
    });
  }

  function readFiltersFromUI() {
    selectedCategories = new Set(
      [...document.querySelectorAll('[data-filter="category"]:checked')].map((el) => el.value)
    );
    selectedRating =
      document.querySelector('input[name="rating-filter"]:checked')?.value || "";
    selectedReviewCount =
      document.querySelector('input[name="review-count-filter"]:checked')?.value || "";
  }

  function filterProducts() {
    let list = [...getProductEntries()];
    const search = searchQuery.toLowerCase();
    const sort = sortSelect.value;
    const proofOnly = proofCheckbox.checked;

    if (selectedCategories.size > 0) {
      list = list.filter((item) => selectedCategories.has(item.product.category));
    }

    if (selectedRating) {
      const min = parseFloat(selectedRating, 10);
      list = list.filter((item) => item.stats.rating >= min);
    }

    if (selectedReviewCount) {
      const min = parseInt(selectedReviewCount, 10);
      list = list.filter((item) => item.stats.displayCount >= min);
    }

    if (proofOnly) {
      list = list.filter((item) => item.stats.hasProof);
    }

    if (search) {
      list = list.filter((item) => {
        const p = item.product;
        const inProduct =
          p.title.toLowerCase().includes(search) ||
          p.instructor.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          (p.platform || "").toLowerCase().includes(search) ||
          getCategoryLabel(p.category).toLowerCase().includes(search) ||
          getCategoryShortLabel(p.category).toLowerCase().includes(search);

        if (inProduct) return true;

        return item.stats.summary.reviews.some(
          (r) =>
            r.title.toLowerCase().includes(search) ||
            r.content.toLowerCase().includes(search)
        );
      });
    }

    if (sort === "reviews-high") {
      list.sort((a, b) => b.stats.displayCount - a.stats.displayCount);
    } else if (sort === "rating-high") {
      list.sort((a, b) => b.stats.rating - a.stats.rating);
    } else if (sort === "date-new") {
      list.sort((a, b) => {
        const da = a.stats.summary.latestDate ? new Date(a.stats.summary.latestDate) : 0;
        const db = b.stats.summary.latestDate ? new Date(b.stats.summary.latestDate) : 0;
        return db - da;
      });
    } else {
      list.sort((a, b) => {
        const scoreA = a.stats.displayCount * 0.7 + a.stats.rating * 25;
        const scoreB = b.stats.displayCount * 0.7 + b.stats.rating * 25;
        return scoreB - scoreA;
      });
    }

    return list;
  }

  function renderStarsHtml(rating) {
    const rounded = Math.round(rating);
    let html = "";
    for (let i = 1; i <= 5; i++) {
      html += `<span class="${i <= rounded ? "on" : "off"}">★</span>`;
    }
    return html;
  }

  function truncateLine(text, max = 28) {
    if (!text) return "";
    const t = String(text).trim();
    return t.length > max ? `${t.slice(0, max)}…` : t;
  }

  function renderProductCard({ product, stats }) {
    const detailUrl = `review-detail.html?id=${product.id}`;
    const catLabel = getCategoryShortLabel(product.category);
    const displayName = getProductDisplayName(product);

    return `
      <article class="rs-card">
        <a href="${detailUrl}" class="rs-card-thumb" tabindex="-1" aria-hidden="true">
          <img src="${product.imageUrl}" alt="" loading="lazy" decoding="async" />
          ${
            stats.hasProof
              ? `<span class="rs-card-proof-badge">証明 ${stats.proofRate}%</span>`
              : ""
          }
        </a>
        <div class="rs-card-main">
          <div class="rs-card-head">
            <span class="rs-card-cat">${App.escapeHtml(catLabel)}</span>
            <h2 class="rs-card-provider">
              <a href="${detailUrl}">${App.escapeHtml(displayName)}</a>
            </h2>
          </div>
          <div class="rs-card-highlights">
            <p class="rs-card-pro">
              <span class="rs-card-hl-label">良</span>
              ${App.escapeHtml(truncateLine(stats.highlightPro, 36))}
            </p>
            <p class="rs-card-con">
              <span class="rs-card-hl-label">悪</span>
              ${App.escapeHtml(truncateLine(stats.highlightCon, 36))}
            </p>
          </div>
        </div>
        <div class="rs-card-score" aria-label="口コミ ${stats.displayCount}件、評価 ${stats.rating}">
          <div class="rs-card-review-hero">
            <span class="rs-card-review-num">${stats.displayCount.toLocaleString("ja-JP")}</span>
            <span class="rs-card-review-label">件</span>
          </div>
          <div class="rs-card-metrics">
            <span class="rs-card-metric-inline">
              <span class="rs-card-stars">${renderStarsHtml(stats.rating)}</span>
              ${stats.rating.toFixed(1)}
            </span>
            <span class="rs-card-metric-inline rs-card-metric-inline--rec">
              おすすめ ${stats.recommendScore.toFixed(1)}
            </span>
          </div>
        </div>
        <a href="${detailUrl}" class="btn btn-trust rs-card-btn">口コミを見る</a>
      </article>`;
  }

  function renderRanking() {
    const ranked = [...getProductEntries()]
      .sort((a, b) => b.stats.displayCount - a.stats.displayCount)
      .slice(0, 5);

    document.getElementById("ranking-list").innerHTML = ranked
      .map(
        ({ product, stats }, i) => `
        <li class="rs-ranking-item">
          <span class="rs-ranking-rank">${i + 1}</span>
          <a href="review-detail.html?id=${product.id}" class="rs-ranking-link">
            <span class="rs-ranking-title">${App.escapeHtml(truncateLine(getProductDisplayName(product), 24))}</span>
            <span class="rs-ranking-meta">口コミ ${stats.displayCount}件</span>
          </a>
        </li>`
      )
      .join("");
  }

  function renderRecentlyViewed() {
    const recent = getRecentlyViewedProducts();
    const container = document.getElementById("recent-list");

    if (!recent.length) {
      container.innerHTML = `<p class="rs-side-empty">まだ閲覧履歴はありません</p>`;
      return;
    }

    container.innerHTML = recent
      .map((product) => {
        const stats = getProductDisplayStats(product);
        return `
        <a href="review-detail.html?id=${product.id}" class="rs-side-item">
          <img src="${product.imageUrl}" alt="" loading="lazy" decoding="async" />
          <span class="rs-side-item-text">
            <span class="rs-side-item-title">${App.escapeHtml(truncateLine(getProductDisplayName(product), 20))}</span>
            <span class="rs-side-item-meta">${App.escapeHtml(getCategoryShortLabel(product.category))}</span>
          </span>
        </a>`;
      })
      .join("");
  }

  function renderPagination(totalPages) {
    const nav = document.getElementById("pagination");
    if (totalPages <= 1) {
      nav.innerHTML = "";
      return;
    }

    let html = `<button type="button" class="page-btn" data-page="prev" ${currentPage === 1 ? "disabled" : ""} aria-label="前のページ">‹</button>`;

    getPageNumbers(currentPage, totalPages).forEach((p) => {
      if (p === "...") {
        html += `<span class="page-ellipsis">…</span>`;
      } else {
        html += `<button type="button" class="page-btn ${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`;
      }
    });

    html += `<button type="button" class="page-btn" data-page="next" ${currentPage === totalPages ? "disabled" : ""} aria-label="次のページ">›</button>`;
    nav.innerHTML = html;

    nav.querySelectorAll(".page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.page;
        if (val === "prev" && currentPage > 1) currentPage--;
        else if (val === "next" && currentPage < totalPages) currentPage++;
        else if (val !== "prev" && val !== "next") currentPage = parseInt(val, 10);
        render();
        scrollToResults();
      });
    });
  }

  function scrollToResults() {
    const target = document.querySelector(".rs-results-head");
    if (target) {
      window.scrollTo({ top: target.offsetTop - 88, behavior: "smooth" });
    }
  }

  function render() {
    const list = filterProducts();
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    document.getElementById("result-count").textContent = `全 ${total.toLocaleString("ja-JP")} 件`;

    const container = document.getElementById("review-list");
    const empty = document.getElementById("empty-state");

    if (total === 0) {
      container.innerHTML = "";
      empty.classList.remove("hidden");
      document.getElementById("pagination").innerHTML = "";
      return;
    }

    empty.classList.add("hidden");
    const start = (currentPage - 1) * PER_PAGE;
    container.innerHTML = list
      .slice(start, start + PER_PAGE)
      .map(renderProductCard)
      .join("");
    renderPagination(totalPages);
  }

  function resetFilters() {
    searchQuery = "";
    sortSelect.value = "recommended";
    proofCheckbox.checked = false;
    selectedCategories.clear();
    selectedRating = "";
    selectedReviewCount = "";
    document.querySelectorAll('[data-filter="category"]').forEach((el) => {
      el.checked = false;
    });
    document.querySelector('input[name="rating-filter"][value=""]').checked = true;
    document.querySelector('input[name="review-count-filter"][value=""]').checked = true;
    syncCategoryCheckboxes();
    currentPage = 1;
    render();
  }

  sortSelect.addEventListener("change", () => {
    currentPage = 1;
    render();
  });

  document.getElementById("filter-submit").addEventListener("click", () => {
    readFiltersFromUI();
    currentPage = 1;
    render();
    scrollToResults();
    if (filterPanel.classList.contains("open")) {
      filterPanel.classList.remove("open");
      filterToggle.setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("filter-clear").addEventListener("click", resetFilters);
  document.getElementById("reset-filters").addEventListener("click", resetFilters);

  filterToggle.addEventListener("click", () => {
    const open = filterPanel.classList.toggle("open");
    filterToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  render();
});

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}
