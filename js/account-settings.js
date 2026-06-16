(function () {
  function escapeHtml(value) {
    return window.App?.escapeHtml?.(value) ?? String(value ?? "");
  }

  function renderSelectOptions(values, selected) {
    return values
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`
      )
      .join("");
  }

  function getSubscriptionBadgeClass(status) {
    const key = String(status || "").toLowerCase();
    if (key === "active" || key === "trialing") return "account-subscription-badge--active";
    if (key === "past_due" || key === "unpaid") return "account-subscription-badge--warn";
    if (key === "canceled") return "account-subscription-badge--muted";
    return "account-subscription-badge--muted";
  }

  function renderProfileSection() {
    const displayName = window.Auth?.getUserName?.() || "";
    const email = window.Auth?.getUserEmail?.() || "";
    const ageGroup = window.Auth?.getAgeGroup?.() || "";
    const gender = window.Auth?.getGender?.() || "";
    const ageGroups = window.Auth?.AGE_GROUPS || [];
    const genders = window.Auth?.GENDERS || [];

    return `
      <div class="account-profile-card">
        <h2 class="account-profile-title">プロフィール</h2>
        <p class="account-profile-lead">口コミ投稿時に年代・性別が表示されます。変更後に投稿する口コミには新しい情報が反映されます。</p>
        <form id="account-profile-form" class="account-profile-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="account-display-name">ユーザー名</label>
            <input
              type="text"
              class="form-input"
              id="account-display-name"
              name="displayName"
              required
              autocomplete="name"
              value="${escapeHtml(displayName)}"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="account-email">メールアドレス</label>
            <input
              type="email"
              class="form-input"
              id="account-email"
              value="${escapeHtml(email)}"
              disabled
              aria-readonly="true"
            />
            <p class="account-field-hint">メールアドレスの変更は現在サポートしていません。</p>
          </div>
          <div class="account-profile-grid">
            <div class="form-group">
              <label class="form-label" for="account-age-group">年代</label>
              <select class="form-input" id="account-age-group" name="ageGroup" required>
                <option value="" disabled${ageGroup ? "" : " selected"}>選択してください</option>
                ${renderSelectOptions(ageGroups, ageGroup)}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="account-gender">性別</label>
              <select class="form-input" id="account-gender" name="gender" required>
                <option value="" disabled${gender ? "" : " selected"}>選択してください</option>
                ${renderSelectOptions(genders, gender)}
              </select>
            </div>
          </div>
          <p class="account-field-hint">個人を特定できる情報は口コミに掲載されません。</p>
          <p id="account-profile-error" class="account-profile-error" role="alert" hidden></p>
          <div class="account-profile-actions">
            <button type="submit" class="btn btn-trust" id="account-profile-save">変更を保存</button>
          </div>
        </form>
      </div>`;
  }

  function renderSubscriptionSection() {
    const profile = window.Auth?.getProfile?.() || {};
    const isPaid = window.AccountApi?.isPaidSubscriptionActive?.() ?? false;
    const status = window.Auth?.getSubscriptionStatus?.() || "";
    const statusLabel =
      window.BillingApi?.getSubscriptionStatusLabel?.(status) ||
      (isPaid ? "有料会員" : "未加入");
    const hasStripeSubscription = Boolean(profile.stripe_subscription_id || profile.stripe_customer_id);
    const canManage = isPaid && hasStripeSubscription;

    const statusNote = (() => {
      const key = String(status || "").toLowerCase();
      if (isPaid && !hasStripeSubscription) {
        return "有料会員として利用中です。Stripe 上の契約情報が見つからない場合は、お問い合わせください。";
      }
      if (key === "past_due") {
        return "お支払い方法の更新が必要です。下のボタンから Stripe の管理画面を開いてください。";
      }
      if (key === "active" || key === "trialing" || isPaid) {
        return "解約・支払い方法の変更・請求履歴の確認は、Stripe の管理画面から行えます。";
      }
      return "月額880円のプランに登録すると、すべての口コミ全文を閲覧できます。";
    })();

    return `
      <div class="account-subscription-card">
        <div class="account-subscription-head">
          <div>
            <h2 class="account-subscription-title">サブスクリプション</h2>
            <p class="account-subscription-plan">月額プラン <span class="account-subscription-price">880円</span>（税込）</p>
          </div>
          <span class="account-subscription-badge ${getSubscriptionBadgeClass(status || (isPaid ? "active" : ""))}">
            ${escapeHtml(statusLabel)}
          </span>
        </div>
        <p class="account-subscription-note">${escapeHtml(statusNote)}</p>
        <div class="account-subscription-actions">
          ${
            canManage
              ? `<button type="button" class="btn btn-trust" id="account-manage-subscription">サブスクリプションを管理</button>`
              : `<a href="pricing.html" class="btn btn-trust">有料プランに登録</a>`
          }
          ${
            canManage
              ? `<p class="account-subscription-hint">解約もこのボタンから Stripe の画面で行えます。</p>`
              : ""
          }
        </div>
      </div>`;
  }

  function showProfileError(message) {
    const errorEl = document.getElementById("account-profile-error");
    if (!errorEl) return;
    if (message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    } else {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
  }

  function bindProfileForm(root) {
    const form = root.querySelector("#account-profile-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showProfileError("");

      const saveBtn = form.querySelector("#account-profile-save");
      const displayName = form.querySelector("#account-display-name")?.value.trim() || "";
      const ageGroup = form.querySelector("#account-age-group")?.value || "";
      const gender = form.querySelector("#account-gender")?.value || "";

      if (!displayName) {
        showProfileError("ユーザー名を入力してください");
        return;
      }
      if (!ageGroup || !gender) {
        showProfileError("年代と性別を選択してください");
        return;
      }

      saveBtn.disabled = true;
      const original = saveBtn.textContent;
      saveBtn.textContent = "保存中...";

      try {
        await window.Auth.updateProfile({ displayName, ageGroup, gender });
        window.App.showToast("プロフィールを更新しました。口コミにも反映されます");
      } catch (err) {
        const message = err.message || "プロフィールの更新に失敗しました";
        showProfileError(message);
        window.App.showToast(message, "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = original;
      }
    });
  }

  function bindSubscriptionActions(root) {
    const manageBtn = root.querySelector("#account-manage-subscription");
    if (!manageBtn) return;

    manageBtn.addEventListener("click", async () => {
      manageBtn.disabled = true;
      const original = manageBtn.textContent;
      manageBtn.textContent = "管理画面へ移動中...";

      try {
        await window.BillingApi.openCustomerPortal({ returnPath: "account-settings.html" });
      } catch (err) {
        window.App.showToast(err.message || "管理画面を開けませんでした", "error");
        manageBtn.disabled = false;
        manageBtn.textContent = original;
      }
    });
  }

  function renderProfile(root) {
    if (!root) return;
    root.innerHTML = renderProfileSection();
    bindProfileForm(root);
  }

  function renderSubscription(root) {
    if (!root) return;
    root.innerHTML = renderSubscriptionSection();
    bindSubscriptionActions(root);
  }

  function render(root) {
    renderSubscription(root);
  }

  window.AccountSettings = {
    render,
    renderProfile,
    renderSubscription,
  };
})();
