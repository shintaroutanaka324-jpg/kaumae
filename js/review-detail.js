/* 投稿フォーム（submit-review.js）と同じ評価項目 */
const RATING_AXES = [
  { key: "costPerformance", label: "コスパ" },
  { key: "recommendation", label: "難易度・継続" },
  { key: "supportQuality", label: "サポート体制" },
  { key: "contentSatisfaction", label: "満足度" },
  { key: "resultRealization", label: "実現性・成果" },
];

function getReviewAxisValue(review, axis) {
  const direct = review[axis.key];
  if (direct != null && direct !== "" && Number(direct) > 0) return Number(direct);
  return Number(review.rating) || 0;
}

document.addEventListener("DOMContentLoaded", async () => {
  await App.whenReady();

  const id = App.getQueryParam("id");
  const product = getProductById(id);
  const root = document.getElementById("detail-root");

  if (product) {
    trackRecentlyViewed(product.id);
    window.ProductPvApi?.recordView?.(product.id);
  }

  if (!product) {
    root.innerHTML = `
      <div class="empty-state">
        <h1 style="font-size:1.5rem;margin-bottom:1rem">サービスが見つかりません</h1>
        <a href="reviews.html" class="btn btn-trust">サービスを探すに戻る</a>
      </div>`;
    return;
  }

  const summary = getProductReviewSummary(product);
  const reviews = summary.reviews;
  const access = await App.getReviewAccessState();
  const unlocked = access.canViewFull;
  const reviewCount = reviews.length;
  const avgRating = reviews.length ? summary.averageRating : 0;
  const starDist = computeStarDistribution(reviews);
  const related = getRelatedProducts(product);
  const officialUrl =
    (typeof ProductsApi?.normalizeExternalUrl === "function"
      ? ProductsApi.normalizeExternalUrl(product.officialUrl)
      : String(product.officialUrl || "").trim()) || "";

  document.title = `${getProductDisplayName(product)} | ${App.SITE_BRAND.nameFull}`;

  App.renderBreadcrumb([
    { label: "トップ", path: "index.html" },
    { label: "オンライン講座", path: "reviews.html" },
    { label: getCategoryLabel(product.category), path: `reviews.html?genre=${product.category}` },
    { label: getProductDisplayName(product) },
  ]);

  root.innerHTML = `
    <div class="pd2">

      ${renderServiceHeader(product, reviewCount, officialUrl)}

      <div class="pd2-body">
        <div class="pd2-main">
          ${renderMainTabs(reviews, reviewCount, unlocked, avgRating, product)}
        </div>

        ${renderSidebar(starDist, reviewCount, avgRating, reviews)}
      </div>

      ${
        related.length
          ? `
      <section class="pd2-related" aria-labelledby="pd2-related-title">
        <h2 id="pd2-related-title" class="pd2-related-title">関連サービス</h2>
        <div class="pd2-related-wrap">
          <button type="button" class="pd2-related-nav" id="related-prev" aria-label="前へ">‹</button>
          <div class="pd2-related-track" id="related-track">${related.map(renderRelatedCard).join("")}</div>
          <button type="button" class="pd2-related-nav" id="related-next" aria-label="次へ">›</button>
        </div>
      </section>`
          : ""
      }
    </div>
  `;

  initProductDetailInteractions(product.id, reviews, unlocked);
  initReviewPaywallBilling();
});

function initReviewPaywallBilling() {
  const startCheckout = async (btn) => {
    if (!Auth.isLoggedIn()) {
      window.location.href = "login.html?redirect=review-detail.html?id=" + encodeURIComponent(App.getQueryParam("id") || "");
      return;
    }
    if (btn) {
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "移動中...";
      try {
        await BillingApi.startCheckout({
          redirectOnLogin: `review-detail.html?id=${encodeURIComponent(App.getQueryParam("id") || "")}`,
        });
      } catch (err) {
        App.showToast(err.message, "error");
        btn.disabled = false;
        btn.textContent = original;
      }
    }
  };

  document.getElementById("pd2-unlock-subscribe")?.addEventListener("click", (e) => {
    startCheckout(e.currentTarget);
  });

  document.querySelectorAll(".pd2-paywall-subscribe").forEach((btn) => {
    btn.addEventListener("click", () => startCheckout(btn));
  });
}

function computeStarDistribution(reviews) {
  const counts = [0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    const b = Math.min(5, Math.max(1, Math.round(r.rating)));
    counts[b - 1]++;
  });
  const n = reviews.length;
  return [5, 4, 3, 2, 1].map((star) => ({
    star,
    pct: n ? Math.round((counts[star - 1] / n) * 100) : 0,
  }));
}

function renderStarBarRow({ star, pct }) {
  return `
    <div class="pd2-star-bar-row">
      <span class="pd2-star-bar-label">${star}★</span>
      <div class="pd2-star-bar-track"><div class="pd2-star-bar-fill" style="width:${pct}%"></div></div>
      <span class="pd2-star-bar-pct">${pct}%</span>
    </div>`;
}

function renderServiceHeader(product, reviewCount, officialUrl) {
  return `
    <section class="pd2-service-header">
      <div class="pd2-service-header-grid">
        <div class="pd2-service-info">
          <h1 class="pd2-service-provider">${App.escapeHtml(getProductDisplayName(product))}</h1>
          <a href="reviews.html?genre=${product.category}" class="pd2-service-cat">${App.escapeHtml(getCategoryLabel(product.category))}</a>
          <a href="#reviews-section" class="pd2-service-reviews">口コミ ${reviewCount.toLocaleString("ja-JP")}件</a>
          <div class="pd2-service-actions">
            ${
              officialUrl
                ? `<a href="${App.escapeHtml(officialUrl)}" class="btn btn-trust" target="_blank" rel="noopener noreferrer">公式サイトを見る</a>`
                : ""
            }
            <a href="submit-review.html" class="btn btn-outline">口コミを投稿する</a>
          </div>
        </div>
      </div>
    </section>`;
}

function renderMainTabs(reviews, reviewCount, unlocked, avgRating, product) {
  return `
    <div class="pd2-tabs-wrap">
      <div class="pd2-tabs" role="tablist" aria-label="口コミ情報">
        <button type="button" class="pd2-tab is-active" role="tab" aria-selected="true" data-tab="reviews" id="pd2-tab-btn-reviews">口コミ一覧</button>
        <button type="button" class="pd2-tab" role="tab" aria-selected="false" data-tab="breakdown" id="pd2-tab-btn-breakdown">評価の内訳</button>
      </div>

      <div class="pd2-tab-panel is-active" role="tabpanel" id="pd2-tab-reviews" aria-labelledby="pd2-tab-btn-reviews">
        <section class="pd2-reviews-section" id="reviews-section" aria-labelledby="pd2-reviews-heading">
          <div class="pd2-reviews-head">
            <div class="pd2-reviews-head-row">
              <h2 id="pd2-reviews-heading" class="pd2-section-title">口コミ一覧（${reviewCount.toLocaleString("ja-JP")}件）</h2>
              <label class="pd2-sort">
                <span class="pd2-sort-label">並び替え</span>
                <select id="pd2-sort">
                  <option value="helpful-high">参考になった順</option>
                  <option value="newest">新しい順</option>
                  <option value="oldest">古い順</option>
                  <option value="rating-high">評価が高い順</option>
                  <option value="rating-low">評価が低い順</option>
                </select>
              </label>
            </div>
          </div>
          <div class="pd2-reviews-list" id="pd2-reviews-list">
            ${
              reviews.length === 0
                ? '<p class="pd2-empty">まだ口コミがありません。<a href="submit-review.html">最初の口コミを投稿</a>してください。</p>'
                : reviews.map((r) => renderReviewCard(r, unlocked, product)).join("")
            }
          </div>
          ${!unlocked ? renderUnlockBanner() : ""}
        </section>
      </div>

      <div class="pd2-tab-panel" role="tabpanel" id="pd2-tab-breakdown" aria-labelledby="pd2-tab-btn-breakdown" hidden>
        ${renderBreakdownTab(reviews, avgRating)}
      </div>
    </div>`;
}

function renderBreakdownRow(label, value) {
  const val = Number(value) || 0;
  const pct = Math.min(100, Math.max(0, (val / 5) * 100));
  return `
    <div class="pd2-breakdown-row">
      <span class="pd2-breakdown-label">${App.escapeHtml(label)}</span>
      <span class="pd2-breakdown-stars" aria-hidden="true">${renderStarsHtml(val)}</span>
      <span class="pd2-breakdown-score">${val.toFixed(1)}</span>
      <div class="pd2-breakdown-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
    </div>`;
}

function renderBreakdownTab(reviews, avgRating) {
  if (!reviews.length) {
    return `
    <section class="pd2-breakdown" aria-label="評価の内訳">
      <h2 class="pd2-section-title">評価の内訳</h2>
      <p class="pd2-empty">まだ口コミがないため、評価の内訳は表示できません。</p>
    </section>`;
  }

  const rows = [
    { label: "総合評価", value: avgRating },
    ...RATING_AXES.map((axis) => {
      const sum = reviews.reduce((total, review) => total + getReviewAxisValue(review, axis), 0);
      return { label: axis.label, value: sum / reviews.length };
    }),
  ];

  return `
    <section class="pd2-breakdown" aria-label="評価の内訳">
      <h2 class="pd2-section-title">評価の内訳</h2>
      <p class="pd2-breakdown-desc">${reviews.length.toLocaleString("ja-JP")}件の口コミから算出した各項目の平均評価です。</p>
      <div class="pd2-breakdown-list">
        ${rows.map((item) => renderBreakdownRow(item.label, item.value)).join("")}
      </div>
    </section>`;
}

function computeAxisAverages(reviews) {
  return RATING_AXES.map((axis) => {
    if (!reviews.length) return { ...axis, value: 0 };
    const sum = reviews.reduce((total, review) => total + getReviewAxisValue(review, axis), 0);
    return { ...axis, value: sum / reviews.length };
  });
}

const RADAR_LABEL_LINES = {
  costPerformance: ["コスパ"],
  recommendation: ["難易度・", "継続"],
  supportQuality: ["サポート", "体制"],
  contentSatisfaction: ["満足度"],
  resultRealization: ["実現性・", "成果"],
};

function radarLabelAnchor(angle) {
  const cos = Math.cos(angle);
  if (cos > 0.35) return "start";
  if (cos < -0.35) return "end";
  return "middle";
}

function renderRadarChartSvg(axes) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 78;
  const levels = 5;
  const n = axes.length;

  function polar(index, value, maxVal = 5) {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n;
    const r = (Math.max(0, value) / maxVal) * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      angle,
    };
  }

  function pathFromPoints(points) {
    return (
      points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(" ") + " Z"
    );
  }

  const grids = [];
  for (let level = 1; level <= levels; level += 1) {
    const pts = axes.map((_, i) => polar(i, level, levels));
    grids.push(`<path d="${pathFromPoints(pts)}" class="pd2-radar-grid" />`);
  }

  const axisLines = axes
    .map((_, i) => {
      const tip = polar(i, levels, levels);
      return `<line x1="${cx}" y1="${cy}" x2="${tip.x.toFixed(2)}" y2="${tip.y.toFixed(2)}" class="pd2-radar-axis" />`;
    })
    .join("");

  const dataPoints = axes.map((axis, i) => polar(i, axis.value));
  const dataPath = pathFromPoints(dataPoints);

  const labels = axes
    .map((axis, i) => {
      const tip = polar(i, levels + 0.72, levels);
      const lines = RADAR_LABEL_LINES[axis.key] || [axis.label];
      const anchor = radarLabelAnchor(tip.angle);
      const lineCount = lines.length;
      const labelBlockHeight = lineCount * 13 + 16;
      const labelY =
        tip.y -
        labelBlockHeight / 2 +
        (tip.angle < -Math.PI / 2 + 0.15 && tip.angle > -Math.PI / 2 - 0.15 ? 4 : 0);

      const tspans = lines
        .map((line, li) => {
          const dy = li === 0 ? "0" : "1.15em";
          return `<tspan x="${tip.x.toFixed(2)}" dy="${dy}">${App.escapeHtml(line)}</tspan>`;
        })
        .join("");

      const scoreY = labelY + lineCount * 13 + 2;

      return `<text x="${tip.x.toFixed(2)}" y="${labelY.toFixed(2)}" class="pd2-radar-label" text-anchor="${anchor}">${tspans}</text><text x="${tip.x.toFixed(2)}" y="${scoreY.toFixed(2)}" class="pd2-radar-score" text-anchor="${anchor}">${axis.value.toFixed(1)}</text>`;
    })
    .join("");

  const dots = dataPoints
    .map(
      (p) =>
        `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="5" class="pd2-radar-dot" />`
    )
    .join("");

  return `<svg viewBox="0 0 ${size} ${size}" class="pd2-radar-chart" role="img" aria-label="5項目の評価レーダーチャート"><rect x="0" y="0" width="${size}" height="${size}" class="pd2-radar-bg" />${grids.join("")}${axisLines}<path d="${dataPath}" class="pd2-radar-area" /><path d="${dataPath}" class="pd2-radar-stroke" />${dots}${labels}</svg>`;
}

function renderRadarChartPanel(reviews) {
  if (!reviews.length) {
    return `
        <div class="pd2-side-panel pd2-side-panel--card pd2-radar-panel">
          <h2 class="pd2-radar-heading">口コミによる項目別評価</h2>
          <p class="pd2-empty pd2-empty--compact">口コミが集まると表示されます</p>
        </div>`;
  }

  const axes = computeAxisAverages(reviews);

  return `
        <div class="pd2-side-panel pd2-side-panel--card pd2-radar-panel">
          <h2 class="pd2-radar-heading">口コミによる項目別評価</h2>
          <p class="pd2-radar-caption">${reviews.length.toLocaleString("ja-JP")}件の口コミ平均 · 5点満点</p>
          <div class="pd2-radar-wrap">${renderRadarChartSvg(axes)}</div>
        </div>`;
}

function renderSidebar(starDist, reviewCount, avgRating, reviews = []) {
  const scoreDisplay = reviewCount ? avgRating.toFixed(1) : "—";
  return `
    <aside class="pd2-sidebar">
      <div class="pd2-sidebar-inner">
        <div class="pd2-side-panel pd2-side-panel--card">
          <h2 class="pd2-side-title">総合評価</h2>
          <p class="pd2-side-score">${scoreDisplay}<span class="pd2-side-score-max">/ 5.0</span></p>
          <p class="pd2-side-count">${reviewCount.toLocaleString("ja-JP")}件の口コミ</p>
        </div>
        ${renderRadarChartPanel(reviews)}
        <div class="pd2-side-panel pd2-side-panel--card">
          <h2 class="pd2-side-title">評価分布</h2>
          ${
            reviewCount
              ? `<div class="pd2-star-bars">${starDist.map((row) => renderStarBarRow(row)).join("")}</div>`
              : `<p class="pd2-empty pd2-empty--compact">口コミが集まると表示されます</p>`
          }
        </div>
      </div>
    </aside>`;
}

const REFUND_GUARANTEE_LABELS = {
  yes: "返金保証がある",
  no: "返金保証はない",
  unknown: "わからない・記載がなかった",
};

function refundGuaranteeLabel(value) {
  return REFUND_GUARANTEE_LABELS[value] || value || "—";
}

function formatReviewPurchasePeriod(review) {
  const y = Number(review.purchaseYear);
  if (!y) return null;
  const m = Number(review.purchaseMonth) || 0;
  return m > 0 ? `${y}年${m}月頃` : `${y}年頃`;
}

function formatReviewPurchasePrice(review) {
  const price = Number(review.purchasePrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  return formatPrice(price);
}

function formatReviewDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr || "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function getRecommendForText(r) {
  return String(r.recommendFor || r.recommend_for || "").trim() || "—";
}

function getNumericResultsText(r) {
  return String(r.numericResult || r.numericResults || r.numeric_results || "").trim();
}

function getBodyOtherText(r) {
  return String(r.bodyOther || r.body_other || "").trim();
}

function renderReviewMetaTable(review, profile) {
  const price = formatReviewPurchasePrice(review);
  const period = formatReviewPurchasePeriod(review);
  const refundValue = review.hasRefundGuarantee || review.has_refund_guarantee || "";
  const refund = refundValue ? refundGuaranteeLabel(refundValue) : "—";

  const cols = [
    { head: "年代", val: profile.age || "—" },
    { head: "性別", val: profile.gender || "—" },
    { head: "購入証明", val: review.verifiedPurchase ? "あり" : "なし" },
    { head: "購入時期", val: period || "—" },
    { head: "購入価格", val: price || "—" },
    { head: "返金保証", val: refund },
  ];

  return `
    <div class="pd2-rc-meta-table" role="presentation">
      <div class="pd2-rc-meta-table-head">
        ${cols.map((c) => `<span>${App.escapeHtml(c.head)}</span>`).join("")}
      </div>
      <div class="pd2-rc-meta-table-body">
        ${cols.map((c) => `<span>${App.escapeHtml(c.val)}</span>`).join("")}
      </div>
    </div>`;
}

function formatReviewScore(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : "—";
}

function renderReviewOverallBlock(r) {
  const score = formatReviewScore(r.rating);
  const stars = score === "—" ? '<span class="pd2-rating-mask">—</span>' : renderStarsHtml(Number(r.rating));
  return `
    <div class="pd2-rc-overall">
      <div class="pd2-rc-overall-main">
        <h4 class="pd2-rc-overall-title">回答者による総合評価</h4>
        <div class="pd2-rc-overall-score">
          <span class="pd2-stars pd2-stars--overall" aria-hidden="true">${stars}</span>
          <strong class="pd2-rc-overall-val">${score}</strong>
        </div>
      </div>
      <time class="pd2-rc-date" datetime="${App.escapeHtml(r.date)}">回答日：${formatReviewDate(r.date)}</time>
    </div>`;
}

function renderReviewRatingsGrid(r) {
  const items = RATING_AXES.map((axis) => {
    const val = getReviewAxisValue(r, axis);
    const score = formatReviewScore(val);
    const stars = score === "—" ? '<span class="pd2-rating-mask">—</span>' : renderStarsHtml(val);
    return `
      <div class="pd2-rc-rating-item">
        <span class="pd2-rc-rating-bullet" aria-hidden="true">▶</span>
        <span class="pd2-rc-rating-label">${App.escapeHtml(axis.label)}</span>
        <span class="pd2-rc-rating-stars pd2-stars" aria-hidden="true">${stars}</span>
        <span class="pd2-rc-rating-val">${score}</span>
      </div>`;
  }).join("");

  return `<div class="pd2-rc-ratings-grid">${items}</div>`;
}

function renderReviewBodyBlock(label, text, unlocked, showCta) {
  return `
    <section class="pd2-rc-body-block">
      <h4 class="pd2-rc-body-heading">${App.escapeHtml(label)}</h4>
      <div class="pd2-rc-body-content">
        ${renderLockableContent(text, unlocked, { showCta, className: "pd2-rc-body-text" })}
      </div>
    </section>`;
}

function getHelpfulStorageKey(reviewId, suffix) {
  return `review-helpful-${suffix}-${reviewId}`;
}

function readHelpfulCount(reviewId) {
  const raw = localStorage.getItem(getHelpfulStorageKey(reviewId, "count"));
  const count = parseInt(raw || "0", 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function hasHelpfulVoted(reviewId) {
  return localStorage.getItem(getHelpfulStorageKey(reviewId, "voted")) === "1";
}

function syncHelpfulButton(btn) {
  const rid = btn.dataset.reviewId;
  if (!rid) return;

  const count = readHelpfulCount(rid);
  const countEl = btn.querySelector(".pd2-helpful-n");
  btn.classList.toggle("is-voted", hasHelpfulVoted(rid));

  if (countEl) {
    countEl.textContent = String(count);
    countEl.hidden = count <= 0;
  }

  const card = btn.closest(".pd2-rc");
  if (card) card.dataset.helpful = String(count);
}

function getReviewServiceName(review, product) {
  const fromReview = String(review.productName || review.product_name || "").trim();
  if (fromReview) return fromReview;
  if (product) return getProductDisplayName(product);
  const linked = review.productId ? getProductById(review.productId) : null;
  if (linked) return getProductDisplayName(linked);
  return "—";
}

function renderReviewCard(r, unlocked, product) {
  const profile = getUserProfile(r);
  const serviceName = getReviewServiceName(r, product);
  const proText = (r.pros || []).join("。") || "—";
  const conText = (r.cons || []).join("。") || "—";
  const beforeText = getBeforeText(r) || "—";
  const afterText = getAfterChangeText(r);
  const recommendText = getRecommendForText(r);
  const helpfulCount = readHelpfulCount(r.id);

  const bodySections = [
    { label: "良かった点・満足した点", text: proText },
    { label: "気になった点・改善してほしい点", text: conText },
    { label: "受講前・利用前の状態", text: beforeText },
    { label: "受講後・利用後の変化", text: afterText },
    { label: "どんな人におすすめしたいか", text: recommendText },
  ];

  const numericText = getNumericResultsText(r);
  const otherText = getBodyOtherText(r);
  if (numericText) bodySections.push({ label: "数値で表せる成果", text: numericText });
  if (otherText) bodySections.push({ label: "その他", text: otherText });

  const bodiesHtml = bodySections
    .map((sec) => renderReviewBodyBlock(sec.label, sec.text, unlocked, !unlocked))
    .join("");

  return `
    <article class="pd2-rc${unlocked ? "" : " pd2-rc--locked"}" data-rating="${r.rating}" data-date="${r.date}" data-helpful="${helpfulCount}" id="review-${App.escapeHtml(r.id)}">
      <header class="pd2-rc-card-header">
        <div class="pd2-rc-card-header-main">
          <div class="pd2-rc-avatar" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <p class="pd2-rc-service-name">${App.escapeHtml(serviceName)}</p>
        </div>
      </header>

      ${renderReviewMetaTable(r, profile)}

      ${renderReviewOverallBlock(r)}

      ${renderReviewRatingsGrid(r)}

      <div class="pd2-rc-bodies">
        ${bodiesHtml}
      </div>

      <footer class="pd2-rc-foot">
        <button type="button" class="pd2-helpful${hasHelpfulVoted(r.id) ? " is-voted" : ""}" data-review-id="${App.escapeHtml(r.id)}" aria-pressed="${hasHelpfulVoted(r.id) ? "true" : "false"}">
          GOOD! <span class="pd2-helpful-n"${helpfulCount > 0 ? "" : " hidden"}>${helpfulCount}</span>
        </button>
      </footer>
    </article>`;
}

function getRelatedProducts(product) {
  const all = getAllProducts();
  return all
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 6)
    .concat(all.filter((p) => p.id !== product.id && p.category !== product.category).slice(0, 4))
    .slice(0, 8);
}

const PAYWALL_BLUR_FILLER =
  "続きの内容は会員登録または口コミ投稿で閲覧できます。実際の受講体験に基づく詳しい評価や具体的なアドバイスが記載されています。";

function isPlaceholderBody(text) {
  const raw = String(text || "").trim();
  return !raw || raw === "—" || raw === "－" || raw === "-" || raw === "（記載なし）";
}

function getPaywallDisplayText(text) {
  const raw = String(text || "").trim();
  if (isPlaceholderBody(raw)) {
    return PAYWALL_BLUR_FILLER.repeat(4);
  }
  if (raw.length < 120) {
    return `${raw} ${PAYWALL_BLUR_FILLER}`;
  }
  return raw;
}

function renderUnlockBanner() {
  return `
    <div class="pd2-unlock">
      <div class="pd2-unlock-icon" aria-hidden="true">🔒</div>
      <p class="pd2-unlock-title">続きを読むには</p>
      <p class="pd2-unlock-desc">口コミ全文を見るには <strong>月額880円で登録</strong> するか、<strong>口コミを投稿</strong> してください。</p>
      <ul class="pd2-unlock-list">
        <li>月額880円で口コミをすべて見る</li>
        <li>または</li>
        <li>口コミを投稿すると閲覧できます</li>
      </ul>
      <div class="pd2-unlock-actions">
        <button type="button" class="btn btn-trust" id="pd2-unlock-subscribe">月額880円で登録する</button>
        <a href="submit-review.html" class="btn btn-outline-trust">口コミを投稿する</a>
      </div>
    </div>`;
}

function renderPaywallCta(showActions = true) {
  if (!showActions) return "";
  return `
    <div class="pd2-paywall-cta">
      <span class="pd2-paywall-lock" aria-hidden="true">🔒</span>
      <p class="pd2-paywall-cta-title">続きを読むには</p>
      <ul class="pd2-paywall-cta-list">
        <li>月額880円で登録</li>
        <li>または</li>
        <li>口コミを投稿</li>
      </ul>
      <div class="pd2-paywall-cta-actions">
        <button type="button" class="btn btn-trust btn-sm pd2-paywall-subscribe">月額880円で登録</button>
        <a href="submit-review.html" class="btn btn-outline-trust btn-sm">口コミを投稿</a>
      </div>
    </div>`;
}

function renderRelatedCard(p) {
  const st = getProductDisplayStats(p);
  return `
    <a href="review-detail.html?id=${p.id}" class="pd2-related-card">
      <div class="pd2-related-body">
        <span class="pd2-related-cat">${App.escapeHtml(getCategoryShortLabel(p.category))}</span>
        <span class="pd2-related-name">${App.escapeHtml(getProductDisplayName(p))}</span>
        <div class="pd2-related-rating">
          <span class="pd2-stars" aria-hidden="true">${renderStarsHtml(st.rating)}</span>
          <strong>${st.rating.toFixed(1)}</strong>
        </div>
        <span class="pd2-related-reviews">口コミ ${st.displayCount}件</span>
        ${p.price > 0 ? `<span class="pd2-related-price">${formatPrice(p.price)}</span>` : ""}
      </div>
    </a>`;
}

function renderStarsHtml(rating) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${i <= Math.round(rating) ? "on" : "off"}">★</span>`;
  }
  return html;
}

function getUserProfile(r) {
  return {
    age: r.age || "",
    gender: r.gender || "",
  };
}

function getBeforeText(r) {
  if (r.situation) return r.situation;
  return "";
}

function getAfterChangeText(r) {
  if (r.learned) return r.learned;
  if (r.results) return r.results;
  if (r.content && r.content.length > 30) return r.content.slice(0, 160) + (r.content.length > 160 ? "…" : "");
  return r.pros?.[0]
    ? `${r.pros[0]}を実践し、受講後に新しいスキルが身についた`
    : "受講・利用を通じて実践的な変化を感じられた";
}

function renderLockableContent(text, unlocked, { showCta = true, className = "pd2-rc-body-text" } = {}) {
  const raw = text || "（記載なし）";
  if (unlocked) {
    return `<p class="${className}">${App.escapeHtml(raw)}</p>`;
  }

  const displayText = App.escapeHtml(getPaywallDisplayText(raw));

  return `
    <div class="pd2-paywall">
      <div class="pd2-paywall-locked">
        <div class="pd2-paywall-copy">
          <p class="pd2-paywall-blur-all" aria-hidden="true">${displayText}</p>
          <p class="pd2-paywall-clear-top">${displayText}</p>
        </div>
        <div class="pd2-paywall-fade"></div>
        ${renderPaywallCta(showCta)}
      </div>
    </div>`;
}


function initProductDetailTabs() {
  const tabs = document.querySelectorAll(".pd2-tab");
  const panels = document.querySelectorAll(".pd2-tab-panel");
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((btn) => {
        const active = btn.dataset.tab === target;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach((panel) => {
        const active = panel.id === `pd2-tab-${target}`;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    });
  });
}

function initProductDetailInteractions(productId, reviews, unlocked) {
  initProductDetailTabs();
  const sortEl = document.getElementById("pd2-sort");
  if (sortEl) {
    sortEl.addEventListener("change", applyReviewSort);
    applyReviewSort();
  }

  function applyReviewSort() {
    const sort = sortEl?.value || "newest";
    const list = document.getElementById("pd2-reviews-list");
    if (!list) return;
    const cards = [...list.querySelectorAll(".pd2-rc")];
    cards.sort((a, b) => {
      const ra = parseFloat(a.dataset.rating, 10);
      const rb = parseFloat(b.dataset.rating, 10);
      const ha = parseInt(a.dataset.helpful, 10) || 0;
      const hb = parseInt(b.dataset.helpful, 10) || 0;
      const da = new Date(a.dataset.date);
      const db = new Date(b.dataset.date);
      if (sort === "helpful-high") return hb - ha;
      if (sort === "newest") return db - da;
      if (sort === "oldest") return da - db;
      if (sort === "rating-high") return rb - ra;
      if (sort === "rating-low") return ra - rb;
      return 0;
    });
    cards.forEach((c) => list.appendChild(c));
  }

  document.querySelectorAll(".pd2-helpful").forEach((btn) => {
    syncHelpfulButton(btn);

    btn.addEventListener("click", () => {
      const rid = btn.dataset.reviewId;
      if (!rid || hasHelpfulVoted(rid)) return;

      localStorage.setItem(getHelpfulStorageKey(rid, "voted"), "1");
      const next = readHelpfulCount(rid) + 1;
      localStorage.setItem(getHelpfulStorageKey(rid, "count"), String(next));
      btn.setAttribute("aria-pressed", "true");
      syncHelpfulButton(btn);
    });
  });

  const track = document.getElementById("related-track");
  const prev = document.getElementById("related-prev");
  const next = document.getElementById("related-next");
  if (track && prev && next) {
    prev.addEventListener("click", () => track.scrollBy({ left: -300, behavior: "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: 300, behavior: "smooth" }));
  }
}
