const SEARCH_HINTS = ["例：○○コーチ / ○○スクール / ○○塾"];

const HOME_REVIEWS_DISPLAY = 3;

const HOME_CATEGORY_META = [
  {
    value: "career-job-change",
    label: "キャリア・転職",
    desc: "転職支援・キャリア相談",
    icon: "career",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  },
  {
    value: "romance-marriage",
    label: "恋愛・婚活",
    desc: "婚活・恋愛コーチング",
    icon: "romance",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.4-7 10-7 10z"/></svg>',
  },
  {
    value: "side-business-independence",
    label: "副業・独立",
    desc: "副業スクール・起業支援",
    icon: "side",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 20h8"/></svg>',
  },
  {
    value: "ai-it-skills",
    label: "AI・ITスキル",
    desc: "AI活用・プログラミング",
    icon: "ai",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h.01M15 9h.01M9 15h6"/></svg>',
  },
  {
    value: "web-marketing",
    label: "Webマーケティング",
    desc: "集客・SNS・広告運用",
    icon: "web",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 17v-4M12 17V9M16 17v-6"/></svg>',
  },
  {
    value: "sales-business-skills",
    label: "営業・ビジネススキル",
    desc: "営業力・提案力の向上",
    icon: "sales",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 11h10M7 15h6"/><path d="M6 4h12l2 4H4l2-4z"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/></svg>',
  },
  {
    value: "health-lifestyle",
    label: "健康・ライフスタイル",
    desc: "健康習慣・メンタルケア",
    icon: "health",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-6-4.35-6-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.65-6 10-6 10z"/></svg>',
  },
  {
    value: "certification-exam",
    label: "資格・試験",
    desc: "資格取得・試験対策講座",
    icon: "cert",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4h12v16l-6-3-6 3V4z"/></svg>',
  },
  {
    value: "english-language",
    label: "英語・語学",
    desc: "英語学習・語学コーチング",
    icon: "english",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
  },
  {
    value: "money-asset-building",
    label: "マネー・資産形成",
    desc: "投資・資産運用・家計管理",
    icon: "money",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="8" rx="7" ry="3"/><path d="M5 8v8c0 1.7 3.1 3 7 3s7-1.3 7-3V8"/></svg>',
  },
];

function renderStarsInline(rating) {
  const full = Math.round(rating);
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${i <= full ? "" : "empty"}">★</span>`;
  }
  return html;
}

document.addEventListener("DOMContentLoaded", async () => {
  await App.whenReady();

  initHeroSearch();
  renderCategories();
  renderReviews();
  renderReviewCountLabel();

  window.addEventListener("reviews:updated", () => {
    renderReviews();
    renderReviewCountLabel();
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    if (!window.ReviewsApi?.loadApprovedReviews) return;
    await window.ReviewsApi.loadApprovedReviews();
  });
});

function renderReviewCountLabel() {
  const el = document.getElementById("home-review-count");
  if (!el) return;

  const total = typeof getAllReviewsMerged === "function" ? getAllReviewsMerged().length : REVIEWS.length;
  el.textContent =
    total > 0
      ? `承認済みの口コミから最新${Math.min(HOME_REVIEWS_DISPLAY, total)}件を表示しています`
      : "";
}

function initHeroSearch() {
  const form = document.getElementById("hero-search-form");
  const input = document.getElementById("hero-search-input");
  const hint = document.getElementById("hero-search-hint");
  if (!form || !input) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) window.location.href = `reviews.html?search=${encodeURIComponent(q)}`;
    else input.focus();
  });

  if (hint && SEARCH_HINTS.length > 1) {
    let i = 0;
    setInterval(() => {
      i = (i + 1) % SEARCH_HINTS.length;
      hint.textContent = SEARCH_HINTS[i];
    }, 5000);
  }
}

function renderCategories() {
  const el = document.getElementById("home-categories");
  if (!el) return;

  const cards = HOME_CATEGORY_META.map(
    (c) => `
    <a href="reviews.html?genre=${encodeURIComponent(c.value)}" class="home-category-card">
      <span class="home-category-icon home-category-icon--${c.icon}" aria-hidden="true">${c.svg}</span>
      <h3 class="home-category-title">${App.escapeHtml(c.label)}</h3>
      <p class="home-category-desc">${App.escapeHtml(c.desc)}</p>
    </a>`
  ).join("");

  const searchCta = `
    <a href="reviews.html" class="home-category-card home-category-card--cta">
      <span class="home-category-icon home-category-icon--search" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      </span>
      <h3 class="home-category-title">サービス名で検索</h3>
      <p class="home-category-desc">気になるカテゴリが見つからない場合は、サービス名で検索してみてください。</p>
    </a>`;

  el.innerHTML = cards + searchCta;
}

function softenLongRuns(text) {
  return String(text || "").replace(/(\S{24})(?=\S)/g, "$1\u200b");
}

function excerptText(text, maxLen = 96) {
  const softened = softenLongRuns(String(text || "").trim());
  const chars = [...softened];
  if (!chars.length) return "";
  if (chars.length <= maxLen) return chars.join("");
  return `${chars.slice(0, maxLen).join("")}…`;
}

function resolveReviewLinks(r, productMap) {
  const product = r.productId ? productMap[r.productId] : null;
  const serviceName = product ? getProductDisplayName(product) : r.productName || "（サービス名非公開）";

  let detailUrl = "reviews.html";
  if (product) {
    detailUrl = `review-detail.html?id=${product.id}`;
  } else if (r.productId) {
    detailUrl = `review-detail.html?id=${r.productId}`;
  } else if (r.productName) {
    detailUrl = `reviews.html?search=${encodeURIComponent(r.productName)}`;
  }

  return { product, serviceName, detailUrl };
}

function resolveReviewImage(product, r) {
  if (product?.imageUrl) return product.imageUrl;
  const category = product?.category || "";
  if (category && typeof getCategoryImageUrl === "function") {
    return getCategoryImageUrl(category);
  }
  return "images/hero-visual.png";
}

function formatReviewerMeta(r, categoryLabel) {
  const parts = [];
  if (categoryLabel && categoryLabel !== "—") parts.push(categoryLabel);
  const demo = [r.age, r.gender].filter(Boolean).join("");
  if (demo) parts.push(demo);
  return parts.join(" / ") || "—";
}

function renderReviewCardHtml(r, productMap) {
  const { product, serviceName, detailUrl } = resolveReviewLinks(r, productMap);
  const rating = r.rating || 4;
  const categoryLabel = product ? getCategoryLabel(product.category) : "—";
  const imageUrl = resolveReviewImage(product, r);
  const body = excerptText(r.content, 96);
  const proofBadge = r.verifiedPurchase
    ? `<span class="home-review-proof">購入証明</span>`
    : "";

  return `
    <article class="home-review-card">
      <a href="${detailUrl}" class="home-review-thumb" tabindex="-1" aria-hidden="true">
        <img src="${App.escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async" />
        ${proofBadge}
      </a>
      <div class="home-review-body">
        <a href="${detailUrl}" class="home-review-name">${App.escapeHtml(serviceName)}</a>
        <div class="home-review-rating" aria-label="評価 ${rating.toFixed(1)}">
          <span class="stars">${renderStarsInline(rating)}</span>
          <strong>${rating.toFixed(1)}</strong>
        </div>
        <p class="home-review-excerpt">${App.escapeHtml(body || "口コミの詳細はサービスページでご確認いただけます。")}</p>
        <footer class="home-review-meta">
          <span>${App.escapeHtml(formatReviewerMeta(r, categoryLabel))}</span>
          <time datetime="${App.escapeHtml(r.date)}">${formatDateJa(r.date)}</time>
        </footer>
      </div>
    </article>`;
}

function renderReviews() {
  const grid = document.getElementById("home-reviews");
  if (!grid || typeof REVIEWS === "undefined") return;

  const productMap = Object.fromEntries(getAllProducts().map((p) => [p.id, p]));
  const items =
    typeof getLatestReviews === "function"
      ? getLatestReviews(HOME_REVIEWS_DISPLAY)
      : [...REVIEWS].slice(0, HOME_REVIEWS_DISPLAY);

  if (!items.length) {
    grid.innerHTML = `
      <div class="home-review-empty">
        現在、口コミを募集中です。あなたの体験が、次に購入する人の判断材料になります。<br>
        <a href="submit-review.html">口コミを投稿する</a>
      </div>`;
    return;
  }

  grid.innerHTML = items.map((r) => renderReviewCardHtml(r, productMap)).join("");
}
