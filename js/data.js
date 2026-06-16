const CATEGORIES = [
  { value: "career-job-change", label: "キャリア・転職" },
  { value: "romance-marriage", label: "恋愛・婚活" },
  { value: "side-business-independence", label: "副業・独立" },
  { value: "ai-it-skills", label: "AI・ITスキル" },
  { value: "web-marketing", label: "Webマーケティング" },
  { value: "sales-business-skills", label: "営業・ビジネススキル" },
  { value: "certification-exam", label: "資格・試験対策" },
  { value: "english-language", label: "英語・語学" },
  { value: "money-asset-building", label: "マネー・資産形成" },
  { value: "health-lifestyle", label: "健康・ライフスタイル" },
  { value: "community-salon", label: "コミュニティ・サロン" },
  { value: "other", label: "その他" },
];

const PRODUCTS = [];

/** サービス検索ページ左カラム用カテゴリ */
const FILTER_CATEGORIES = [
  { value: "side-business-independence", label: "副業" },
  { value: "romance-marriage", label: "恋愛" },
  { value: "money-asset-building", label: "投資" },
  { value: "ai-it-skills", label: "AI" },
  { value: "web-marketing", label: "Webマーケ" },
  { value: "sales-business-skills", label: "営業" },
  { value: "certification-exam", label: "資格" },
];

const POPULAR_TAGS = [
  { label: "#副業", category: "side-business-independence" },
  { label: "#AI", category: "ai-it-skills" },
  { label: "#恋愛", category: "romance-marriage" },
  { label: "#投資", category: "money-asset-building" },
];

const CATEGORY_SHORT_LABELS = {
  "side-business-independence": "副業",
  "romance-marriage": "恋愛",
  "money-asset-building": "投資",
  "ai-it-skills": "AI",
  "web-marketing": "Webマーケ",
  "sales-business-skills": "営業",
  "certification-exam": "資格",
  "career-job-change": "キャリア",
  "english-language": "英語",
  "health-lifestyle": "健康",
  "community-salon": "コミュニティ",
  other: "その他",
};

const SITE_STATS = {
  serviceCount: 0,
  reviewCount: 0,
  reviewerCount: 0,
  averageRating: 0,
};

const TRENDING_SEARCHES = [];

const REVIEWS = [];

function getCategoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

let _dbProductsPublished = [];
let _dbProductsAdmin = [];
let _dbProductRegistry = [];

/** 公開サイト用: 公開中の DB サービスのみ */
function setDbProducts(products) {
  _dbProductsPublished = Array.isArray(products) ? products : [];
}

/** DB 上の全サービス id（静的データとの重複判定に使用） */
function setDbProductRegistry(entries) {
  _dbProductRegistry = Array.isArray(entries) ? entries : [];
}

/** 運営画面用: 公開・非公開を含む DB サービス */
function setDbProductsAdmin(products) {
  _dbProductsAdmin = Array.isArray(products) ? products : [];
  if (typeof setDbProductRegistry === "function") {
    setDbProductRegistry(
      products.map((p) => ({
        id: p.id,
        isPublished: p.isPublished !== false,
      }))
    );
  }
}

/** 静的データ（data.js）と DB 登録サービスを統合（公開サイト向け） */
function getAllProducts() {
  const publishedDb = _dbProductsPublished;
  const overriddenStaticIds = new Set(_dbProductRegistry.map((p) => p.id));
  const staticOnly = PRODUCTS.filter((p) => !overriddenStaticIds.has(p.id));
  return [...publishedDb, ...staticOnly];
}

/** 運営画面向け: 非公開 DB サービスと静的データを統合 */
function getAllProductsAdmin() {
  const dbIds = new Set(_dbProductsAdmin.map((p) => p.id));
  const staticOnly = PRODUCTS.filter((p) => !dbIds.has(p.id));
  return [..._dbProductsAdmin, ...staticOnly];
}

function getProductById(id) {
  if (!id) return undefined;
  return getAllProducts().find((p) => p.id === id);
}

/** 運営が設定したサービス名称（公開表示用） */
function getProductDisplayName(product) {
  return String(product?.title || "").trim() || "—";
}

/** 公開画面用の投稿者表示名（匿名ユーザーIDサフィックスを除去） */
function normalizeReviewerDisplayName(name) {
  const raw = String(name || "").trim();
  if (!raw) return "匿名ユーザー";
  return raw.replace(/^匿名ユーザー[-–—]?[A-F0-9]{4}$/i, "匿名ユーザー");
}

let _approvedDbReviews = [];

function setApprovedDbReviews(reviews) {
  _approvedDbReviews = Array.isArray(reviews) ? reviews : [];
}

function getAllReviewsMerged() {
  const seen = new Set();
  const merged = [];

  for (const review of [...REVIEWS, ..._approvedDbReviews]) {
    if (seen.has(review.id)) continue;
    seen.add(review.id);
    merged.push(review);
  }

  return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getLatestReviews(limit = 6) {
  const dbSorted = [..._approvedDbReviews].sort((a, b) => new Date(b.date) - new Date(a.date));
  const staticSorted = REVIEWS.filter((r) => !dbSorted.some((d) => d.id === r.id)).sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  if (dbSorted.length > 0) {
    return [...dbSorted, ...staticSorted].slice(0, limit);
  }

  return staticSorted.slice(0, limit);
}

function getReviewsByProductId(productId) {
  return getAllReviewsMerged().filter((r) => r.productId === productId);
}

/** 商品（商材）単位の口コミ集計 */
function getProductReviewSummary(product) {
  const reviews = getReviewsByProductId(product.id);
  const sorted = [...reviews].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!sorted.length) {
    return {
      reviews: [],
      reviewCount: product.reviewCount || 0,
      averageRating: product.averageRating || 0,
      latestDate: null,
      latestReview: null,
    };
  }

  const averageRating = sorted.reduce((sum, r) => sum + r.rating, 0) / sorted.length;

  return {
    reviews: sorted,
    reviewCount: sorted.length,
    averageRating,
    latestDate: sorted[0].date,
    latestReview: sorted[0],
  };
}

function formatPrice(price) {
  return "¥" + price.toLocaleString("ja-JP");
}

function formatPriceRange(price) {
  if (price >= 100000) return "10万円〜";
  if (price >= 50000) return "5万円〜10万円";
  if (price >= 30000) return "3万円〜5万円";
  return "〜3万円";
}

function formatDateJa(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function renderStars(rating, max = 5) {
  let html = '<div class="stars">';
  for (let i = 1; i <= max; i++) {
    html += `<span class="${i <= Math.round(rating) ? "" : "empty"}">★</span>`;
  }
  html += "</div>";
  return html;
}

const TRUST_BADGE_ICONS = {
  purchase:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>',
};

/** 購入証明を提出した口コミにのみバッジを表示 */
function renderReviewTrustBadges(review, options = {}) {
  if (!review.verifiedPurchase) return "";

  const large = options.large === true;
  const cls = large ? "trust-badge trust-badge--lg" : "trust-badge";
  const rowClass = large ? "trust-badges-row trust-badges-row--lg" : "trust-badges-row";
  return `<div class="${rowClass}"><span class="${cls} trust-badge--purchase" title="購入証明を提出済み">${TRUST_BADGE_ICONS.purchase}購入証明済み</span></div>`;
}

function hasAnyTrustBadge(review) {
  return Boolean(review.verifiedPurchase);
}

function getCategoryShortLabel(value) {
  return CATEGORY_SHORT_LABELS[value] || getCategoryLabel(value);
}

const RECENT_VIEWED_KEY = "recentlyViewedProducts";
const RECENT_VIEWED_MAX = 5;

function trackRecentlyViewed(productId) {
  if (!productId) return;
  let ids = [];
  try {
    ids = JSON.parse(localStorage.getItem(RECENT_VIEWED_KEY) || "[]");
  } catch {
    ids = [];
  }
  ids = ids.filter((id) => id !== productId);
  ids.unshift(productId);
  ids = ids.slice(0, RECENT_VIEWED_MAX);
  localStorage.setItem(RECENT_VIEWED_KEY, JSON.stringify(ids));
}

function getRecentlyViewedProducts() {
  let ids = [];
  try {
    ids = JSON.parse(localStorage.getItem(RECENT_VIEWED_KEY) || "[]");
  } catch {
    return [];
  }
  return ids.map((id) => getProductById(id)).filter(Boolean);
}

/** 一覧・カード表示用の集計 */
function getProductDisplayStats(product) {
  const summary = getProductReviewSummary(product);
  const reviews = summary.reviews;
  const displayCount = Math.max(product.reviewCount || 0, summary.reviewCount || 0);
  const rating = reviews.length ? summary.averageRating : product.averageRating || 0;

  let proofRate = product.proofRate;
  if (reviews.length) {
    const verified = reviews.filter((r) => r.verifiedPurchase).length;
    proofRate = Math.round((verified / reviews.length) * 100);
  }
  if (proofRate == null) proofRate = 0;

  let recommendScore = rating;
  const withRec = reviews.filter((r) => r.recommendation != null);
  if (withRec.length) {
    recommendScore = withRec.reduce((s, r) => s + r.recommendation, 0) / withRec.length;
  }

  let highlightPro = product.highlightPro;
  let highlightCon = product.highlightCon;
  if (reviews.length) {
    const sorted = [...reviews].sort((a, b) => b.rating - a.rating);
    const best = sorted[0];
    highlightPro = best.pros?.[0] || highlightPro || "購入者から高評価の口コミあり";
    highlightCon = best.cons?.[0] || highlightCon || "気になる点も口コミで確認できます";
  }
  if (!highlightPro) highlightPro = "口コミを投稿して最初の1件に";
  if (!highlightCon) highlightCon = "購入前に口コミで確認しましょう";

  return {
    summary,
    displayCount,
    rating,
    proofRate,
    recommendScore,
    highlightPro,
    highlightCon,
    hasProof: proofRate >= 50,
  };
}
