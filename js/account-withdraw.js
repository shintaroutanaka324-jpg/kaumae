(function () {
  const REASON_KEYS = [
    "hard_to_use",
    "few_reviews",
    "price",
    "not_found",
    "no_longer_use",
    "other",
  ];

  function renderPaidBlock() {
    return `
      <div class="account-card withdraw-card withdraw-paid-block">
        <h1>アカウントを退会する</h1>
        <p>有料プランを解約後に退会できます。</p>
        <div class="withdraw-actions" style="justify-content:center">
          <a href="account-settings.html" class="btn btn-trust">サブスクリプションを管理</a>
          <a href="account-settings.html" class="btn btn-outline">戻る</a>
        </div>
      </div>`;
  }

  function renderForm() {
    const reasons = REASON_KEYS.map(
      (key) => `
        <label class="withdraw-reason-item">
          <input type="radio" name="withdraw-reason" value="${key}" />
          <span>${App.escapeHtml(AccountApi.reasonLabel(key))}</span>
        </label>`
    ).join("");

    return `
      <div class="account-card withdraw-card">
        <header class="account-header">
          <h1>アカウントを退会する</h1>
        </header>

        <p class="withdraw-intro">
          退会するとログイン情報および会員情報が削除されます。<br />
          なお、投稿済み口コミはサービスの公平性および他ユーザーの参考情報を維持するため、掲載を継続します。
        </p>

        <section class="withdraw-section" aria-labelledby="withdraw-survey-title">
          <h2 class="withdraw-section-title" id="withdraw-survey-title">退会理由を教えてください</h2>
          <p class="withdraw-section-note">任意回答</p>
          <div class="withdraw-reason-list" role="radiogroup" aria-label="退会理由">
            ${reasons}
          </div>
          <div class="withdraw-other-field" id="withdraw-other-wrap">
            <label class="form-label" for="withdraw-other-text">その他の理由</label>
            <textarea class="form-input" id="withdraw-other-text" rows="3" placeholder="具体的な理由をご記入ください"></textarea>
          </div>
        </section>

        <div class="withdraw-warning-box">
          <h2>退会時の注意事項</h2>
          <ul class="withdraw-warning-list">
            <li>ログインできなくなります</li>
            <li>個人情報は削除されます</li>
            <li>購入証明データは削除されます</li>
            <li>メール通知は停止されます</li>
            <li>退会後は元に戻せません</li>
            <li>投稿済み口コミは掲載を継続します</li>
          </ul>
        </div>

        <label class="withdraw-consent" for="withdraw-consent">
          <input type="checkbox" id="withdraw-consent" />
          <span>上記内容を確認し、退会後に元へ戻せないことを理解しました。</span>
        </label>

        <div class="withdraw-actions">
          <a href="account-settings.html" class="btn btn-outline">戻る</a>
          <button type="button" class="btn btn-danger" id="withdraw-submit-btn" disabled>退会する</button>
        </div>
      </div>`;
  }

  function getSelectedReason() {
    return document.querySelector('input[name="withdraw-reason"]:checked')?.value || null;
  }

  function updateSubmitState() {
    const consent = document.getElementById("withdraw-consent");
    const submitBtn = document.getElementById("withdraw-submit-btn");
    if (!submitBtn) return;

    const reason = getSelectedReason();
    const otherText = document.getElementById("withdraw-other-text")?.value.trim() || "";
    const otherInvalid = reason === "other" && otherText.length === 0;

    submitBtn.disabled = !(consent?.checked && !otherInvalid);
  }

  function bindFormEvents() {
    const otherWrap = document.getElementById("withdraw-other-wrap");
    const consent = document.getElementById("withdraw-consent");
    const submitBtn = document.getElementById("withdraw-submit-btn");
    const modal = document.getElementById("withdraw-modal");
    const modalCancel = document.getElementById("withdraw-modal-cancel");
    const modalConfirm = document.getElementById("withdraw-modal-confirm");

    document.querySelectorAll('input[name="withdraw-reason"]').forEach((input) => {
      input.addEventListener("change", () => {
        const isOther = getSelectedReason() === "other";
        otherWrap?.classList.toggle("is-visible", isOther);
        updateSubmitState();
      });
    });

    document.getElementById("withdraw-other-text")?.addEventListener("input", updateSubmitState);
    consent?.addEventListener("change", updateSubmitState);

    submitBtn?.addEventListener("click", () => {
      if (submitBtn.disabled) return;
      modal?.classList.add("is-open");
      modal?.removeAttribute("hidden");
    });

    modalCancel?.addEventListener("click", () => {
      modal?.classList.remove("is-open");
      modal?.setAttribute("hidden", "");
    });

    modal?.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("is-open");
        modal.setAttribute("hidden", "");
      }
    });

    modalConfirm?.addEventListener("click", async () => {
      modalConfirm.disabled = true;
      modalConfirm.textContent = "処理中...";

      try {
        const reason = getSelectedReason() || "unspecified";
        const reasonOther =
          reason === "other" ? document.getElementById("withdraw-other-text")?.value.trim() : null;

        await AccountApi.withdrawAccount({ reason, reasonOther });
        window.location.href = "account-withdraw-complete.html";
      } catch (err) {
        if (err.code === "paid_subscription_active") {
          window.location.reload();
          return;
        }
        App.showToast(err.message || "退会に失敗しました", "error");
        modal?.classList.remove("is-open");
        modal?.setAttribute("hidden", "");
      } finally {
        modalConfirm.disabled = false;
        modalConfirm.textContent = "退会する";
      }
    });
  }

  async function init() {
    await App.whenReady();

    if (!Auth.isLoggedIn()) {
      window.location.href = "login.html?redirect=account-withdraw.html";
      return;
    }

    App.renderBreadcrumb([
      { label: "トップ", path: "index.html" },
      { label: "アカウント設定", path: "account-settings.html" },
      { label: "アカウントを退会する" },
    ]);

    const root = document.getElementById("withdraw-root");
    if (!root) return;

    if (AccountApi.isPaidSubscriptionActive()) {
      root.innerHTML = renderPaidBlock();
      return;
    }

    root.innerHTML = renderForm();
    bindFormEvents();
    updateSubmitState();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
