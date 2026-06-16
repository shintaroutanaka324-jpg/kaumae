(function () {
  const TZ = "Asia/Tokyo";

  function formatDateInTz(date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function getMonthKey(dateStr) {
    return String(dateStr || "").slice(0, 7);
  }

  function buildLastNDays(n, endDateStr) {
    const end = new Date(`${endDateStr}T12:00:00`);
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      days.push(formatDateInTz(d));
    }
    return days;
  }

  /** 詳細ページ表示時に PV を記録（失敗しても UI に影響しない） */
  function recordView(productId) {
    if (!productId || !window.Auth?.getClient?.()) return;

    const client = window.Auth.getClient();
    client
      .rpc("record_product_page_view", { p_product_id: String(productId) })
      .then(({ error }) => {
        if (error) console.warn("[カウマエ] PV記録", error.message);
      })
      .catch((err) => console.warn("[カウマエ] PV記録", err));
  }

  /** 運営画面用: product_id → { monthlyPv, previousMonthPv, last8Days } */
  async function loadAdminStats() {
    const client = window.Auth?.getClient?.();
    if (!client || !window.Auth?.isAdmin?.()) return {};

    const today = formatDateInTz(new Date());
    const fromDate = buildLastNDays(62, today)[0];

    const { data, error } = await client
      .from("product_pv_daily")
      .select("product_id, view_date, view_count")
      .gte("view_date", fromDate);

    if (error) {
      if (error.message?.includes("product_pv_daily") || error.code === "42P01") {
        console.warn("[カウマエ] PVテーブル未作成: schema-product-pv.sql を実行してください");
        return {};
      }
      console.warn("[カウマエ] PV取得", error.message);
      return {};
    }

    const thisMonth = getMonthKey(today);
    const prevMonthDate = new Date(`${today}T12:00:00`);
    prevMonthDate.setDate(1);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const previousMonth = getMonthKey(formatDateInTz(prevMonthDate));
    const last8DayKeys = buildLastNDays(8, today);

    const stats = {};

    for (const row of data || []) {
      const id = row.product_id;
      const count = Number(row.view_count) || 0;
      const monthKey = getMonthKey(row.view_date);

      if (!stats[id]) {
        stats[id] = {
          monthlyPv: 0,
          previousMonthPv: 0,
          dailyMap: {},
        };
      }

      if (monthKey === thisMonth) stats[id].monthlyPv += count;
      if (monthKey === previousMonth) stats[id].previousMonthPv += count;
      stats[id].dailyMap[row.view_date] = (stats[id].dailyMap[row.view_date] || 0) + count;
    }

    const result = {};
    for (const [id, item] of Object.entries(stats)) {
      result[id] = {
        monthlyPv: item.monthlyPv,
        previousMonthPv: item.previousMonthPv,
        last8Days: last8DayKeys.map((day) => item.dailyMap[day] || 0),
      };
    }

    return result;
  }

  function getProductMonthlyPv(pvStats, productId) {
    return pvStats?.[productId]?.monthlyPv || 0;
  }

  window.ProductPvApi = {
    recordView,
    loadAdminStats,
    getProductMonthlyPv,
    buildLastNDays,
  };
})();
