(function () {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }
        // HTML に直書きされた同期 script は既に実行済み（load は発火済みで待ち続けるとハングする）
        if (!existing.async && !existing.defer) {
          existing.dataset.loaded = "true";
          resolve();
          return;
        }
        existing.addEventListener(
          "load",
          () => {
            existing.dataset.loaded = "true";
            resolve();
          },
          { once: true }
        );
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  const authBootstrap = (async () => {
    await loadScript("js/supabase-config.js");
    await loadScript("js/auth.js");
    await window.Auth.whenReady();
    try {
      await loadScript("js/reviews-api.js");
      await window.ReviewsApi?.whenReady?.();
    } catch (err) {
      console.warn("[カウマエ] reviews-api の読み込みをスキップ", err);
    }
    try {
      if (!window.ProductsApi) {
        await loadScript("js/products-api.js?v=20260617categories2");
      }
      await window.ProductsApi?.whenReady?.();
    } catch (err) {
      console.warn("[カウマエ] products-api の読み込みをスキップ", err);
    }
    try {
      await loadScript("js/billing-api.js");
    } catch (err) {
      console.warn("[カウマエ] billing-api の読み込みをスキップ", err);
    }
    try {
      await loadScript("js/product-pv-api.js");
    } catch (err) {
      console.warn("[カウマエ] product-pv-api の読み込みをスキップ", err);
    }
    try {
      await loadScript("js/admin-pending-count.js");
    } catch (err) {
      console.warn("[カウマエ] admin-pending-count の読み込みをスキップ", err);
    }
  })();

  async function refreshAdminPendingBadges() {
    if (window.Auth?.isAdmin?.() && window.AdminPendingCount?.refresh) {
      await AdminPendingCount.refresh();
    } else if (window.AdminPendingCount?.clear) {
      AdminPendingCount.clear();
    }
  }

  function whenReady() {
    return authBootstrap;
  }

  const SUB_NAV_ITEMS = [
    { label: "トップ", path: "index.html", icon: "home" },
    {
      label: "サービスを探す",
      path: "reviews.html",
      alsoActive: ["review-detail.html"],
      icon: "search",
    },
    { label: "カウマエとは", path: "about.html", icon: "info" },
    { label: "口コミを投稿する", path: "submit-review.html", icon: "edit" },
    { label: "Q&A", path: "faq.html", icon: "help" },
    { label: "問い合わせ", path: "contact.html", icon: "mail" },
  ];

  const SUB_NAV_ICON = {
    home:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    edit:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    help:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.7.6-1.2 1.3-1.2 2.2"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>',
    mail:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><circle cx="12" cy="8" r=".5" fill="currentColor"/></svg>',
  };

  function isSubNavActive(item, current) {
    if (current === item.path) return true;
    if ((current === "" || current === "index.html") && item.path === "index.html") return true;
    if (item.alsoActive?.includes(current)) return true;
    return false;
  }

  function renderSubNavLink(item, current, { mobile = false } = {}) {
    const active = isSubNavActive(item, current);
    const base = mobile ? "mobile-nav-link" : "sub-nav-link";
    const classes = [base, active ? "active" : "", item.cta ? `${base}--cta` : ""]
      .filter(Boolean)
      .join(" ");
    const icon = SUB_NAV_ICON[item.icon] || "";
    return `<a href="${item.path}" class="${classes}"${active ? ' aria-current="page"' : ""}>
      ${icon ? `<span class="${base}-icon">${icon}</span>` : ""}
      <span class="${base}-label${mobile ? "" : " sub-nav-label"}">${item.label}</span>
    </a>`;
  }

  function renderSubNavLinks(current, options = {}) {
    return SUB_NAV_ITEMS.map((item) => renderSubNavLink(item, current, options)).join("");
  }

  function isLoggedIn() {
    return window.Auth?.isLoggedIn() ?? false;
  }

  function getUserName() {
    return window.Auth?.getUserName() ?? "ユーザー";
  }

  function getUserEmail() {
    return window.Auth?.getUserEmail() ?? "";
  }

  function hasUnlockedReviews() {
    return localStorage.getItem("reviewsUnlocked") === "true";
  }

  async function canViewFullReview() {
    if (window.ReviewsApi?.canViewFullReview) {
      return window.ReviewsApi.canViewFullReview();
    }
    return hasUnlockedReviews();
  }

  async function getReviewAccessState() {
    if (window.ReviewsApi?.getReviewAccessState) {
      return window.ReviewsApi.getReviewAccessState();
    }
    return {
      loggedIn: isLoggedIn(),
      isPaidMember: false,
      hasPostedReview: hasUnlockedReviews(),
      canViewFull: hasUnlockedReviews(),
    };
  }

  function getCurrentPage() {
    const path = window.location.pathname.split("/").pop() || "index.html";
    return path;
  }

  function showToast(message, type = "success") {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove("show"), 3000);
  }

  /**
   * ロゴの差し替え方法:
   * 1. images/ フォルダに logo.png や logo.svg を置く
   * 2. imageSrc を "images/logo.png" などに変更
   * 3. 画像にサイト名が入っている場合は showSiteName: false
   */
  const SITE_BRAND = {
    nameJa: "カウマエ",
    nameEn: "",
    nameFull: "カウマエ",
  };

  const SITE_LOGO = {
    imageSrc: "images/logo.png",
    alt: "カウマエ — 口コミで、失敗しない選択を。",
    siteName: SITE_BRAND.nameJa,
    siteNameEn: SITE_BRAND.nameEn,
    showSiteName: false,
  };

  function renderLogoInner() {
    const img = `<img src="${SITE_LOGO.imageSrc}" alt="${escapeHtml(SITE_LOGO.alt)}" class="logo-img" width="44" height="44" />`;
    const en = SITE_LOGO.siteNameEn
      ? `<span class="logo-text-en">${escapeHtml(SITE_LOGO.siteNameEn)}</span>`
      : "";
    const name = SITE_LOGO.showSiteName
      ? `<span class="logo-text">${escapeHtml(SITE_LOGO.siteName)}${en}</span>`
      : "";
    return img + name;
  }

  let userMenuClickBound = false;

  function bindUserMenuDismiss() {
    if (userMenuClickBound) return;
    userMenuClickBound = true;
    document.addEventListener("click", (e) => {
      const menu = document.querySelector(".user-menu");
      if (menu && !menu.contains(e.target)) {
        document.getElementById("user-dropdown")?.classList.remove("open");
      }
    });
  }

  function renderAccountMenuLinks() {
    let html = `<a href="my-reviews.html">投稿した口コミ</a>`;
    html += `<a href="account-settings.html">アカウント設定</a>`;
    if (window.Auth?.isAdmin?.()) {
      html += `<a href="admin-dashboard.html">運営ダッシュボード</a>`;
    }
    return html;
  }

  function renderMobileAccountLinks() {
    let html = `<a href="my-reviews.html" class="mobile-account-link">投稿した口コミ</a>`;
    html += `<a href="account-settings.html" class="mobile-account-link">アカウント設定</a>`;
    if (window.Auth?.isAdmin?.()) {
      html += `<a href="admin-dashboard.html" class="mobile-account-link">運営ダッシュボード</a>`;
    }
    return html;
  }

  function bindHeaderListeners() {
    document.getElementById("header-search-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = document.getElementById("header-search")?.value.trim();
      if (q) window.location.href = `reviews.html?search=${encodeURIComponent(q)}`;
    });

    document.getElementById("mobile-search-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = document.getElementById("mobile-search")?.value.trim();
      if (q) window.location.href = `reviews.html?search=${encodeURIComponent(q)}`;
    });

    document.getElementById("menu-toggle")?.addEventListener("click", () => {
      document.getElementById("mobile-nav")?.classList.toggle("open");
    });

    document.getElementById("user-menu-btn")?.addEventListener("click", () => {
      document.getElementById("user-dropdown")?.classList.toggle("open");
    });

    document.getElementById("logout-btn")?.addEventListener("click", logout);
    document.getElementById("mobile-logout")?.addEventListener("click", logout);
  }

  function renderHeader() {
    const el = document.getElementById("site-header");
    if (!el) return;

    const loggedIn = isLoggedIn();
    const userName = getUserName();
    const userEmail = getUserEmail();
    const isPaid = window.Auth?.isPaidMember?.() ?? false;
    const current = getCurrentPage();

    el.innerHTML = `
      <div class="container site-chrome-inner">
        <header class="site-header">
          <div class="header-inner">
            <a href="index.html" class="logo">${renderLogoInner()}</a>
            <form class="search-form" id="header-search-form">
              <div class="search-wrap">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input type="text" class="search-input" id="header-search" placeholder="発信者名・アカウント名で口コミを検索..." />
              </div>
            </form>
            <nav class="header-nav">
              ${
                loggedIn
                  ? `
                <div class="user-menu">
                  <button type="button" class="user-btn" id="user-menu-btn">
                    <span class="avatar">👤</span>
                    <span class="user-name">${escapeHtml(userName)}</span>
                    ${isPaid ? '<span class="member-badge">有料会員</span>' : ""}
                    <span class="user-btn-caret" aria-hidden="true">▼</span>
                  </button>
                  <div class="dropdown dropdown--account" id="user-dropdown">
                    ${userEmail ? `<p class="dropdown-email">${escapeHtml(userEmail)}</p>` : ""}
                    ${renderAccountMenuLinks()}
                    <hr>
                    <button type="button" id="logout-btn">ログアウト</button>
                  </div>
                </div>`
                  : `
                <a href="login.html" class="btn btn-ghost btn-sm">ログイン</a>
                <a href="register.html" class="btn btn-trust btn-sm">新規登録</a>`
              }
            </nav>
            <button type="button" class="menu-toggle" id="menu-toggle" aria-label="メニュー">☰</button>
          </div>
        </header>
        <nav class="sub-nav" aria-label="メインナビゲーション">
          <div class="sub-nav-inner">
            ${renderSubNavLinks(current)}
          </div>
        </nav>
      </div>
      <div class="container mobile-nav" id="mobile-nav">
          ${
            loggedIn
              ? `<div class="mobile-user-bar">
                  <span class="avatar" aria-hidden="true">👤</span>
                  <div class="mobile-user-info">
                    <span class="user-name">${escapeHtml(userName)}</span>
                    ${userEmail ? `<span class="user-email">${escapeHtml(userEmail)}</span>` : ""}
                    ${isPaid ? '<span class="member-badge">有料会員</span>' : ""}
                  </div>
                </div>`
              : ""
          }
          <form id="mobile-search-form" class="mobile-search-form">
            <div class="search-wrap">
              <input type="text" class="search-input mobile-search-input" id="mobile-search" placeholder="発信者名・アカウント名で口コミを検索..." />
            </div>
          </form>
          <div class="mobile-nav-links">
            ${renderSubNavLinks(current, { mobile: true })}
          </div>
          ${
            loggedIn
              ? `<nav class="mobile-account-links" aria-label="アカウント">
                  ${renderMobileAccountLinks()}
                </nav>`
              : ""
          }
          <div class="mobile-nav-actions">
          ${
            loggedIn
              ? `<button type="button" class="btn btn-ghost btn-block" id="mobile-logout">ログアウト</button>`
              : `<a href="login.html" class="btn btn-ghost btn-block">ログイン</a>
                 <a href="register.html" class="btn btn-trust btn-block">新規登録</a>`
          }
          </div>
        </div>
    `;

    bindHeaderListeners();
  }

  async function logout() {
    try {
      await window.Auth?.signOut();
    } catch (err) {
      console.warn("[カウマエ] ログアウトエラー", err);
    }
    showToast("ログアウトしました");
    setTimeout(() => (window.location.href = "index.html"), 500);
  }

  function renderFooter() {
    const el = document.getElementById("site-footer");
    if (!el) return;

    el.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-top">
          <div>
            <div class="footer-logo">${renderLogoInner()}</div>
            <p class="footer-desc">
              オンライン講座・コーチング・情報商材・SNS発信者の商品・サロン・副業スクールの購入前口コミサイト。口コミの透明性で、高額講座の失敗を防ぎます。
            </p>
            <div class="social-links">
              <a href="https://x.com/kaumaereview" target="_blank" rel="noopener noreferrer" aria-label="X（@kaumaereview）">𝕏</a>
            </div>
          </div>
          <div class="footer-col">
            <h4>サービス</h4>
            <ul class="footer-links">
              <li><a href="reviews.html">サービスを探す</a></li>
              <li><a href="submit-review.html">口コミを投稿する</a></li>
              <li><a href="faq.html">Q&amp;A</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>サポート</h4>
            <ul class="footer-links">
              <li><a href="contact.html">お問い合わせ</a></li>
              <li><a href="deletion-request.html">削除依頼</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>運営情報</h4>
            <ul class="footer-links">
              <li><a href="terms.html">利用規約</a></li>
              <li><a href="privacy.html">プライバシーポリシー</a></li>
              <li><a href="tokushoho.html">特定商取引法に基づく表記</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; ${new Date().getFullYear()} ${escapeHtml(SITE_BRAND.nameFull)}. All rights reserved.</p>
        </div>
      </footer>
    `;
  }

  function renderBreadcrumbList(items) {
    return items
      .map((item, i) => {
        const isLast = i === items.length - 1;
        const label = escapeHtml(item.label);
        if (item.path && !isLast) {
          return `<li><a href="${item.path}">${label}</a></li>`;
        }
        return `<li><span class="breadcrumb-current" aria-current="page">${label}</span></li>`;
      })
      .join("");
  }

  function renderBreadcrumb(items) {
    const el = document.getElementById("breadcrumb");
    if (!el || !items.length) return;

    el.innerHTML = `
      <nav class="breadcrumb" aria-label="パンくず">
        <div class="container">
          <ol class="breadcrumb-list">
            ${renderBreadcrumbList(items)}
          </ol>
        </div>
      </nav>
    `;
  }

  function initFaqAccordion(selector) {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".faq-item");
        const wasOpen = item.classList.contains("open");
        item.parentElement.querySelectorAll(".faq-item").forEach((el) => el.classList.remove("open"));
        if (!wasOpen) item.classList.add("open");
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindUserMenuDismiss();
    await whenReady();
    renderHeader();
    renderFooter();
    await refreshAdminPendingBadges();
    window.BillingApi?.handlePaymentQueryParams?.();
    window.BillingApi?.handleBillingReturnQueryParams?.();
  });

  window.addEventListener("auth:changed", async () => {
    renderHeader();
    await refreshAdminPendingBadges();
  });

  window.App = {
    SITE_BRAND,
    whenReady,
    isLoggedIn,
    getUserName,
    getUserEmail,
    hasUnlockedReviews,
    canViewFullReview,
    getReviewAccessState,
    showToast,
    renderHeader,
    renderFooter,
    renderBreadcrumb,
    renderBreadcrumbList,
    initFaqAccordion,
    getQueryParam,
    escapeHtml,
  };
})();
