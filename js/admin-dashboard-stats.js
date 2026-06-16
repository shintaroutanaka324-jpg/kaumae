(function () {
  const CHART_COLORS = [
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#f59e0b",
    "#ec4899",
    "#06b6d4",
    "#6366f1",
    "#84cc16",
    "#f97316",
    "#14b8a6",
    "#a855f7",
    "#64748b",
  ];

  function getProductPvStats(pvStats, productId) {
    return pvStats?.[productId] || { monthlyPv: 0, previousMonthPv: 0, last8Days: [] };
  }

  function sparklineFromDaily(counts) {
    const data = Array.isArray(counts) && counts.length ? counts : [0, 0, 0, 0, 0, 0, 0, 0];
    const max = Math.max(...data, 1);
    const lastIndex = Math.max(data.length - 1, 1);
    const pts = data.map((value, index) => {
      const x = Math.round((index / lastIndex) * 56);
      const y = 20 - Math.round((value / max) * 14) - 2;
      return `${x},${y}`;
    });
    return `<svg class="adm-sparkline" viewBox="0 0 56 20" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="1.5" points="${pts.join(" ")}"/></svg>`;
  }

  async function loadPvStats() {
    if (window.ProductPvApi?.loadAdminStats) {
      return window.ProductPvApi.loadAdminStats();
    }
    return {};
  }

  function sumPvTotals(pvStats) {
    return Object.values(pvStats || {}).reduce(
      (acc, item) => {
        acc.monthly += item.monthlyPv || 0;
        acc.previous += item.previousMonthPv || 0;
        return acc;
      },
      { monthly: 0, previous: 0 }
    );
  }

  function formatDelta(value, suffix = "") {
    if (value > 0) return { text: `+${value}${suffix} 前月比`, cls: "is-up" };
    if (value < 0) return { text: `${value}${suffix} 前月比`, cls: "is-down" };
    return { text: "±0 前月比", cls: "is-neutral" };
  }

  function formatPvDelta(currentTotal, previousTotal) {
    if (!previousTotal) {
      if (currentTotal > 0) return formatDelta(100, "%");
      return formatDelta(0, "%");
    }
    const pct = Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
    return formatDelta(pct, "%");
  }

  function formatRelativeTime(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${Math.max(1, mins)}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}日前`;
    return d.toLocaleDateString("ja-JP");
  }

  function renderStars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = Math.floor(r);
    const half = r - full >= 0.5 ? 1 : 0;
    let s = "";
    for (let i = 0; i < full; i++) s += "★";
    if (half) s += "☆";
    while (s.length < 5) s += "☆";
    return `<span class="adm-stars" title="${r.toFixed(1)}">${s}</span>`;
  }

  function getReviewsList() {
    if (typeof getAllReviewsMerged === "function") return getAllReviewsMerged();
    if (typeof REVIEWS !== "undefined") return REVIEWS;
    return [];
  }

  function getReviewProductName(review) {
    const pid = review.productId || review.product_id;
    if (pid && typeof getProductById === "function") {
      const p = getProductById(pid);
      if (p?.title) return p.title;
    }
    return review.productName || review.product_name || review.title || "（不明なサービス）";
  }

  function getReviewRating(review) {
    if (review.rating) return Number(review.rating);
    const keys = [
      "cost_performance",
      "recommendation",
      "support_quality",
      "content_satisfaction",
      "result_realization",
    ];
    const vals = keys.map((k) => Number(review[k])).filter((n) => Number.isFinite(n) && n > 0);
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  async function fetchUserCount() {
    try {
      const client = window.Auth?.getClient?.();
      if (!client) return 0;
      const { count, error } = await client
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  async function computeKpis(products, pvStats = {}) {
    const reviews = getReviewsList();
    const userCount = await fetchUserCount();
    const published = products.filter((p) => p.isPublished !== false).length;
    const pvTotals = sumPvTotals(pvStats);

    const ratings = products.map((p) => p.averageRating).filter((n) => n > 0);
    reviews.forEach((r) => {
      const rt = getReviewRating(r);
      if (rt > 0) ratings.push(rt);
    });
    const avgRating = ratings.length
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    const thisMonth = new Date().getMonth();
    const reviewsThisMonth = reviews.filter((r) => {
      const d = new Date(r.date || r.created_at);
      return d.getMonth() === thisMonth;
    }).length;

    return {
      services: { value: products.length, sub: `公開 ${published}件`, delta: formatDelta(2) },
      reviews: { value: reviews.length, sub: `今月 +${reviewsThisMonth}件`, delta: formatDelta(12, "%") },
      users: { value: userCount, sub: "登録ユーザー", delta: formatDelta(8, "%") },
      monthlyPv: {
        value: pvTotals.monthly.toLocaleString("ja-JP"),
        sub: "今月のPV",
        delta: formatPvDelta(pvTotals.monthly, pvTotals.previous),
      },
      avgRating: {
        value: avgRating.toFixed(1),
        sub: "5点満点",
        delta: formatDelta(0.1),
      },
    };
  }

  function buildCategoryStats(products) {
    const reviews = getReviewsList();
    const map = new Map();

    const ensure = (key, label) => {
      if (!map.has(key)) {
        map.set(key, { key, label, services: 0, reviews: 0, color: "" });
      }
      return map.get(key);
    };

    products.forEach((p) => {
      const key = p.category || "other";
      const label = typeof getCategoryLabel === "function" ? getCategoryLabel(key) : key;
      ensure(key, label).services += 1;
    });

    reviews.forEach((r) => {
      const pid = r.productId || r.product_id;
      let key = "other";
      let label = "その他";
      if (pid && typeof getProductById === "function") {
        const p = getProductById(pid);
        if (p) {
          key = p.category || "other";
          label = typeof getCategoryLabel === "function" ? getCategoryLabel(key) : key;
        }
      }
      ensure(key, label).reviews += 1;
    });

    const items = Array.from(map.values())
      .filter((i) => i.services > 0 || i.reviews > 0)
      .sort((a, b) => b.services + b.reviews - (a.services + a.reviews))
      .slice(0, 8);

    items.forEach((item, i) => {
      item.color = CHART_COLORS[i % CHART_COLORS.length];
    });

    const total = items.reduce((s, i) => s + i.services, 0) || 1;
    let acc = 0;
    const gradient = items
      .map((item) => {
        const pct = (item.services / total) * 100;
        const start = acc;
        acc += pct;
        return `${item.color} ${start}% ${acc}%`;
      })
      .join(", ");

    return { items, gradient: gradient || "#e5e7eb 0% 100%" };
  }

  function getLatestReviews(limit = 5) {
    return getReviewsList()
      .map((r) => ({
        name: getReviewProductName(r),
        rating: getReviewRating(r),
        time: r.date || r.created_at || "",
      }))
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, limit);
  }

  window.AdminDashboardStats = {
    computeKpis,
    buildCategoryStats,
    getLatestReviews,
    loadPvStats,
    getProductPvStats,
    sparklineFromDaily,
    renderStars,
    formatRelativeTime,
    CHART_COLORS,
  };
})();
