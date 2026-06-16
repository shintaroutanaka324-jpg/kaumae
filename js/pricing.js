document.addEventListener("DOMContentLoaded", async () => {
  await App.whenReady();

  App.renderBreadcrumb([
    { label: "トップ", path: "index.html" },
    { label: "料金プラン" },
  ]);

  const statusEl = document.getElementById("pricing-member-status");
  const subscribeBtn = document.getElementById("pricing-subscribe-btn");
  const subscribeHint = document.getElementById("pricing-subscribe-hint");

  if (Auth.isLoggedIn() && Auth.isPaidMember()) {
    if (statusEl) {
      statusEl.innerHTML =
        '<p class="pricing-member-banner pricing-member-banner--active"><span class="member-badge member-badge--lg">有料会員</span> 口コミ全文と評価ポイントを閲覧できます。</p>';
    }
    if (subscribeBtn) {
      subscribeBtn.textContent = "有料会員登録済み";
      subscribeBtn.disabled = true;
      subscribeBtn.classList.remove("btn-trust");
      subscribeBtn.classList.add("btn-outline");
    }
    if (subscribeHint) {
      subscribeHint.innerHTML =
        '解約・支払い方法の変更は <a href="account-settings.html">アカウント設定</a> から行えます。';
    }
    return;
  }

  if (statusEl && Auth.isLoggedIn()) {
    statusEl.innerHTML =
      '<p class="pricing-member-banner">口コミ全文を見るには <strong>月額880円で登録</strong> するか、<strong>口コミを投稿</strong> してください。</p>';
  }

  subscribeBtn?.addEventListener("click", async () => {
    if (!Auth.isLoggedIn()) {
      window.location.href = "login.html?redirect=pricing.html";
      return;
    }

    subscribeBtn.disabled = true;
    const original = subscribeBtn.textContent;
    subscribeBtn.textContent = "決済ページへ移動中...";

    try {
      await BillingApi.startCheckout({ redirectOnLogin: "pricing.html" });
    } catch (err) {
      App.showToast(err.message || "決済を開始できませんでした", "error");
      subscribeBtn.disabled = false;
      subscribeBtn.textContent = original;
    }
  });
});
