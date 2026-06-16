const SEARCH_HINTS = [
  "例：○○コーチ / ○○スクール / ○○塾",
  "サービス名で検索",
  "講師名で検索",
  "SNSアカウント名で検索",
];

const HOME_REVIEWS_LIMIT = 6;
const HOME_REVIEWS_PER_PAGE = 3;

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
  renderTrending();
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
  const latestCount = Math.min(HOME_REVIEWS_LIMIT, total);
  el.textContent =
    total > 0
      ? `承認済みの口コミから最新${latestCount}件を表示しています（全${total}件）`
      : "購入証明を提出した口コミには「購入証明済み」バッジが付きます（提出は任意）";
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
    }, 4000);
  }
}

function renderTrending() {
  const wrap = document.getElementById("home-trending-wrap");
  const el = document.getElementById("home-trending");
  if (!el || typeof TRENDING_SEARCHES === "undefined") return;

  const items = TRENDING_SEARCHES.slice(0, 4);
  if (!items.length) {
    if (wrap) wrap.hidden = true;
    return;
  }
  if (wrap) wrap.hidden = false;
  el.innerHTML = items
    .map((t) => {
      const hint = t.hint ? `（${App.escapeHtml(t.hint)}）` : "";
      return `<a href="reviews.html?search=${encodeURIComponent(t.query)}" class="trending-tag trending-tag--rich trending-tag--cell">${App.escapeHtml(t.label)}<span class="trending-tag-hint">${hint}</span></a>`;
    })
    .join("");
}

function renderCategories() {
  const el = document.getElementById("home-categories");
  if (!el) return;

  el.innerHTML = CATEGORIES.map(
    (c) =>
      `<a href="reviews.html?genre=${c.value}" class="category-chip">${App.escapeHtml(c.label)}</a>`
  ).join("");
}

function softenLongRuns(text) {
  return String(text || "").replace(/(\S{24})(?=\S)/g, "$1\u200b");
}

function excerptText(text, maxLen = 100) {
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

function renderReviewCardHtml(r, productMap) {
  const { product, serviceName, detailUrl } = resolveReviewLinks(r, productMap);
  const rating = r.rating || 4;
  const category = product ? getCategoryLabel(product.category) : "—";
  const badges = renderReviewTrustBadges(r, { large: true });
  const noBadgeNote = hasAnyTrustBadge(r)
    ? ""
    : `<p class="review-no-badge">購入記録未提出の口コミ</p>`;
  const dbBadge = r._fromDb ? `<span class="review-feed-db-badge">新着</span>` : "";
  const title = excerptText(r.title, 48);
  const body = excerptText(r.content, 100);
  const showReadMore = [...String(r.content || "")].length > 100 || [...String(r.title || "")].length > 48;

  return `
      <article class="review-feed-card review-feed-card--primary">
        <header class="review-feed-header">
          <div class="review-feed-rating-large">
            <span class="rating-big">${rating.toFixed(1)}</span>
            <span class="stars">${renderStarsInline(rating)}</span>
          </div>
          <time class="review-feed-date" datetime="${App.escapeHtml(r.date)}">${formatDateJa(r.date)}</time>
        </header>
        ${badges}
        ${dbBadge}
        ${noBadgeNote}
        <a href="${detailUrl}" class="review-feed-service-name review-feed-service-name--lg">${App.escapeHtml(serviceName)}</a>
        <p class="review-feed-instructor">${App.escapeHtml(category)}</p>
        <h3 class="review-feed-title review-feed-title--lg">${App.escapeHtml(title)}</h3>
        <p class="review-feed-body review-feed-body--lg">${App.escapeHtml(body)}</p>
        <footer class="review-feed-footer">
          <span class="review-feed-user">${App.escapeHtml(normalizeReviewerDisplayName(r.userName))}${r.age ? `（${App.escapeHtml(r.age)}）` : ""}</span>
          <a href="${detailUrl}" class="review-feed-link">${showReadMore ? "続きを読む →" : "詳細を見る →"}</a>
        </footer>
      </article>`;
}

function renderReviews() {
  const track = document.getElementById("home-reviews");
  const carousel = document.getElementById("home-reviews-carousel");
  if (!track || typeof REVIEWS === "undefined") return;

  const productMap = Object.fromEntries(getAllProducts().map((p) => [p.id, p]));
  const items =
    typeof getLatestReviews === "function" ? getLatestReviews(HOME_REVIEWS_LIMIT) : [...REVIEWS];
  const pages = [];

  for (let i = 0; i < items.length; i += HOME_REVIEWS_PER_PAGE) {
    pages.push(items.slice(i, i + HOME_REVIEWS_PER_PAGE));
  }

  if (pages.length === 0) {
    track.innerHTML = `
      <div class="reviews-carousel-slide review-feed review-feed--primary">
        <p class="review-feed-empty">まだ公開中の口コミがありません。<a href="submit-review.html">最初の口コミを投稿</a>してください。</p>
      </div>`;
    if (carousel) {
      carousel.classList.add("reviews-carousel--single");
    }
    return;
  }

  track.innerHTML = pages
    .map(
      (page) =>
        `<div class="reviews-carousel-slide review-feed review-feed--primary">${page
          .map((r) => renderReviewCardHtml(r, productMap))
          .join("")}</div>`
    )
    .join("");

  if (carousel) {
    initReviewsCarousel(carousel, track, pages.length);
  }
}

function initReviewsCarousel(carousel, track, pageCount) {
  const prevBtn = document.getElementById("home-reviews-prev");
  const nextBtn = document.getElementById("home-reviews-next");
  if (!prevBtn || !nextBtn) return;

  let pageIndex = 0;

  const update = () => {
    track.style.transform = `translateX(-${pageIndex * 100}%)`;
    prevBtn.disabled = pageIndex === 0;
    nextBtn.disabled = pageIndex >= pageCount - 1;
    carousel.classList.toggle("reviews-carousel--end", pageIndex >= pageCount - 1);
  };

  prevBtn.onclick = () => {
    if (pageIndex > 0) {
      pageIndex -= 1;
      update();
    }
  };

  nextBtn.onclick = () => {
    if (pageIndex < pageCount - 1) {
      pageIndex += 1;
      update();
    }
  };

  carousel.classList.remove("reviews-carousel--single", "reviews-carousel--end");
  if (pageCount <= 1) {
    nextBtn.disabled = true;
    prevBtn.disabled = true;
    carousel.classList.add("reviews-carousel--single");
  }

  pageIndex = 0;
  update();
}
