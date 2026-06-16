const RATING_SCALE = [
  { stars: 5, label: "とても良い" },
  { stars: 4, label: "良い" },
  { stars: 3, label: "普通" },
  { stars: 2, label: "やや不満" },
  { stars: 1, label: "不満" },
];

const REFUND_GUARANTEE_OPTIONS = [
  { value: "yes", label: "返金保証がある" },
  { value: "no", label: "返金保証はない" },
  { value: "unknown", label: "わからない・記載がなかった" },
];

const PROOF_MAX_BYTES = 10 * 1024 * 1024;
const PROOF_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.gif";

let proofPreviewUrl = null;

const RATING_ITEMS = [
  { key: "costPerformance", label: "コスパ", desc: "価格に見合った内容か", icon: "coin" },
  { key: "recommendation", label: "難易度・継続", desc: "続けやすさ・学びやすさ", icon: "repeat" },
  { key: "supportQuality", label: "サポート体制", desc: "質問対応・フォローの充実度", icon: "support" },
  { key: "contentSatisfaction", label: "満足度", desc: "内容への満足の度合い", icon: "heart" },
  { key: "resultRealization", label: "実現性・成果", desc: "成果や変化の実感", icon: "target" },
];

const BODY_ITEMS = [
  {
    id: "bodyPros",
    label: "良かった点・満足した点",
    shortLabel: "良かった点",
    minChars: 100,
    required: true,
    description: "受講・利用して良かった点や満足した点を、具体的なエピソードを交えて書いてください。",
    placeholder:
      "例）カリキュラムが段階的で初心者でも迷わず進められた。特に〇〇の解説が分かりやすく、実際に試したところすぐに成果が出た、など",
    icon: "smile",
  },
  {
    id: "bodyConcerns",
    label: "気になった点・改善してほしい点",
    shortLabel: "気になった点",
    minChars: 30,
    required: true,
    description: "受講・利用して気になった点や、改善してほしいと感じた点を書いてください。",
    placeholder:
      "例）質問への返信に1週間ほどかかる日があった。動画の音量が小さい箇所があり、聞き取りづらかった、など",
    icon: "alert",
  },
  {
    id: "bodyBefore",
    label: "受講前・利用前の状態",
    shortLabel: "受講前・利用前の状態",
    minChars: 50,
    required: true,
    description: "受講・利用する前に、どのような悩み・課題・不安があったかを書いてください。",
    placeholder: "例）受講前は、何から学べばよいか分からず、独学で何度も挫折していました。",
    icon: "situation",
  },
  {
    id: "bodyResults",
    label: "受講後・利用後の変化",
    shortLabel: "受講後・利用後の変化",
    minChars: 50,
    required: true,
    description: "受講・利用した後に、どのような成果・変化・気づきがあったかを書いてください。",
    placeholder:
      "例）受講後は、学習手順が明確になり、自分で簡単な制作物を作れるようになりました。",
    icon: "results",
  },
  {
    id: "bodyRecommend",
    label: "どんな人におすすめしたいか",
    shortLabel: "おすすめしたい人",
    minChars: 50,
    required: true,
    description: "このサービスをどのような人におすすめできるか、理由とあわせて書いてください。",
    placeholder:
      "例）本業が忙しくても隙間時間で学びたい方。〇〇で悩んでいるが、まず一歩踏み出したい方におすすめ、など",
    icon: "users",
  },
  {
    id: "numericResults",
    label: "数値で表せる成果",
    shortLabel: "数値で表せる成果",
    minChars: 0,
    required: false,
    description: "売上、年収、学習時間、作業時間、案件獲得数など、数値で表せる成果があれば入力してください。",
    examples: [
      "残業時間が月15時間から3時間になった",
      "学習時間を週10時間確保できるようになった",
      "売上が月30万円から50万円になった",
    ],
    placeholder: "数値で表せる変化があれば記載してください",
    icon: "numeric",
    rows: 3,
  },
  {
    id: "bodyOther",
    label: "その他",
    shortLabel: "その他",
    minChars: 0,
    required: false,
    description: "上記以外で伝えたいことがあれば書いてください。",
    placeholder: "例）サポートの対応が丁寧だった、受講生コミュニティの雰囲気が良かった、など",
    icon: "note",
    rows: 4,
  },
];

const REQUIRED_BODY_ITEMS = BODY_ITEMS.filter((item) => item.required);

const REVIEW_DRAFT_VERSION = 1;
const REVIEW_DRAFT_DEBOUNCE_MS = 1500;
let draftSaveTimer = null;

const ITEM_ICONS = {
  coin: '<path d="M12 4v16M8 8a4 4 0 1 0 8 0 4 4 0 0 0-8 0z"/>',
  repeat:
    '<path d="M17 2l3 3-3 3"/><path d="M20 5H10a5 5 0 0 0-5 5v1"/><path d="M7 22l-3-3 3-3"/><path d="M4 19h10a5 5 0 0 0 5-5v-1"/>',
  support:
    '<path d="M12 3a6 6 0 0 0-6 6v4l-2 2h16l-2-2V9a6 6 0 0 0-6-6z"/><path d="M10 21h4"/>',
  heart:
    '<path d="M12 20.5s-7-4.6-7-9.4C5 7.6 7.8 5 11 5c1.8 0 3.2.8 4 2.1C15.8 5.8 17.2 5 19 5c3.2 0 6 2.6 6 6.1 0 4.8-7 9.4-7 9.4z"/>',
  target:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  smile:
    '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
  alert:
    '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><circle cx="12" cy="16" r=".5" fill="currentColor"/>',
  learn:
    '<path d="M12 3 3 7.5 12 12l9-4.5L12 3z"/><path d="M6 10v5c0 2 2.5 4 6 4s6-2 6-4v-5"/>',
  users:
    '<path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"/><circle cx="9" cy="7" r="3"/><path d="M22 19v-1a4 4 0 0 0-3-3.87"/><path d="M16 3.13a3 3 0 0 1 0 5.74"/>',
  note:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 13h4M10 17h4"/>',
  situation:
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5"/><circle cx="12" cy="16.5" r=".5" fill="currentColor"/>',
  results:
    '<path d="M4 19h16"/><path d="M6 17l4-8 3 5 5-9 4 6"/>',
  numeric:
    '<path d="M4 19h16"/><path d="M7 15l3-6 2 4 3-5 3 7"/>',
};

function getBodyItem(id) {
  return BODY_ITEMS.find((item) => item.id === id);
}

function getMinCharsForItem(item) {
  return item?.minChars ?? 0;
}

function countChars(value) {
  return window.ReviewQuality?.countChars?.(value) ?? [...String(value || "")].length;
}

function isLowQualityText(text, minChars = 50) {
  return window.ReviewQuality?.isLowQualityText?.(text, minChars) ?? false;
}

function renderCharCount(item) {
  if (!item.required) {
    return `<p class="sr-char-count sr-char-count--optional" id="${item.id}-count" aria-live="polite">0文字（任意）</p>`;
  }
  const min = item.minChars;
  return `
    <p class="sr-char-count is-invalid" id="${item.id}-count" aria-live="polite">0 / ${min}文字（あと${min}文字）</p>
    <p class="sr-quality-error hidden" id="${item.id}-quality" role="alert">内容が適切ではありません。具体的な体験を記載してください。</p>`;
}

function renderPurchasePeriodFields() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 15; y--) years.push(y);

  return `
    <div class="sr-period-fields">
      <div class="sr-period-field">
        <select class="select" id="purchaseYear" required aria-label="購入年">
          <option value="">年を選択</option>
          ${years.map((y) => `<option value="${y}">${y}年</option>`).join("")}
        </select>
      </div>
      <span class="sr-period-suffix">頃</span>
    </div>
    <p class="form-hint">おおよその購入年で構いません</p>`;
}

function renderItemIcon(item) {
  const paths = ITEM_ICONS[item.icon] || ITEM_ICONS.coin;
  return `
    <span class="sr-item-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        ${paths}
      </svg>
    </span>`;
}

function renderStarRating(name) {
  return `
    <div class="sr-stars" data-rating-name="${name}" role="group" aria-label="星評価">
      ${[1, 2, 3, 4, 5]
        .map(
          (i) =>
            `<button type="button" class="sr-star" data-star="${i}" aria-label="${i}つ星">
              <span class="sr-star-fill" aria-hidden="true">★</span>
            </button>`
        )
        .join("")}
    </div>
    <input type="hidden" name="${name}" id="${name}" value="0" required />`;
}

function renderStaticStars(count) {
  const full = Math.floor(count);
  const half = count % 1 >= 0.5;
  let html = "★".repeat(full);
  if (half) html += "☆";
  html += `<span class="sr-scale-empty">${"★".repeat(5 - full - (half ? 1 : 0))}</span>`;
  return `<span class="sr-scale-stars" aria-hidden="true">${html}</span>`;
}

function renderReadOnlyStars(value) {
  const v = Number(value);
  const stars = [1, 2, 3, 4, 5]
    .map((star) => {
      const classes = ["sr-star", "sr-star--readonly"];
      if (v >= star) classes.push("is-full");
      else if (v >= star - 0.5) classes.push("is-half");
      return `<span class="${classes.join(" ")}" aria-hidden="true"><span class="sr-star-fill">★</span></span>`;
    })
    .join("");
  return `<span class="sr-stars sr-stars--readonly" aria-label="${v}つ星">${stars}</span><span class="sr-confirm-rating-val">（${v}）</span>`;
}

function formatRatingStars(value) {
  return renderReadOnlyStars(value);
}

function refundGuaranteeLabel(value) {
  return REFUND_GUARANTEE_OPTIONS.find((o) => o.value === value)?.label || value || "—";
}

function renderRefundGuaranteeField() {
  return `
    <fieldset class="sr-refund-field form-group">
      <legend class="form-label">返金保証はありましたか？ <span class="sr-required">*</span></legend>
      <div class="sr-refund-options">
        ${REFUND_GUARANTEE_OPTIONS.map(
          (opt) => `
          <label class="sr-refund-option">
            <input type="radio" name="hasRefundGuarantee" value="${opt.value}" required />
            <span>${App.escapeHtml(opt.label)}</span>
          </label>`
        ).join("")}
      </div>
    </fieldset>`;
}

function renderRatingRows() {
  return RATING_ITEMS.map(
    (item, index) => `
    <div class="sr-rating-row${index < RATING_ITEMS.length - 1 ? " sr-rating-row--border" : ""}">
      <div class="sr-rating-row-label">
        ${renderItemIcon(item)}
        <div>
          <strong>${item.label} <span class="sr-required" aria-hidden="true">*</span></strong>
          <span class="sr-detail-desc">${App.escapeHtml(item.desc)}</span>
        </div>
      </div>
      ${renderStarRating(item.key)}
    </div>`
  ).join("");
}

function renderBodyRows() {
  const requiredHtml = REQUIRED_BODY_ITEMS.map(
    (item, index) => renderBodyItem(item, index < REQUIRED_BODY_ITEMS.length - 1)
  ).join("");

  const optionalItems = BODY_ITEMS.filter((item) => !item.required);
  const optionalHtml = optionalItems.length
    ? `
      <div class="sr-body-optional-head">
        <h3 class="sr-body-optional-title">任意項目</h3>
        <p class="form-hint">入力しなくても投稿できます</p>
      </div>
      ${optionalItems.map((item, index) => renderBodyItem(item, index < optionalItems.length - 1)).join("")}`
    : "";

  return requiredHtml + optionalHtml;
}

function renderBodyExamples(item) {
  if (!item.examples?.length) return "";
  return `
    <div class="sr-body-examples">
      <p class="sr-body-examples-label">入力例</p>
      <ul class="sr-body-examples-list">
        ${item.examples.map((ex) => `<li>${App.escapeHtml(ex)}</li>`).join("")}
      </ul>
    </div>`;
}

function renderBodyItem(item, showBorder) {
  const min = getMinCharsForItem(item);
  return `
    <div class="sr-body-item${showBorder ? " sr-body-item--border" : ""}${item.required ? "" : " sr-body-item--optional"}">
      <div class="sr-body-item-head">
        ${renderItemIcon(item)}
        <label class="form-label" for="${item.id}">
          ${item.label}
          ${item.required ? '<span class="sr-required">*</span>' : '<span class="sr-optional">任意</span>'}
        </label>
      </div>
      <div class="sr-body-item-content">
        <p class="form-hint sr-body-description">${App.escapeHtml(item.description)}</p>
        ${renderBodyExamples(item)}
        <textarea class="form-textarea sr-textarea" id="${item.id}" rows="${item.rows || 5}"
          ${item.required ? "required" : ""}
          data-min-chars="${min}"
          data-required="${item.required ? "true" : "false"}"
          placeholder="${App.escapeHtml(item.placeholder)}"></textarea>
        ${renderCharCount(item)}
      </div>
    </div>`;
}

function renderRatingScale() {
  return RATING_SCALE.map(
    (row) => `
    <div class="sr-scale-row">
      ${renderStaticStars(row.stars)}
      <span class="sr-scale-label">${row.label}</span>
    </div>`
  ).join("");
}

function renderSidebar() {
  return `
    <aside class="sr-sidebar">
      <div class="sr-side-box sr-side-box--guide">
        <h3>投稿前のご案内</h3>
        <ul class="sr-side-list">
          <li>実際に購入・受講した商品・サービスのみ投稿できます</li>
          <li>口コミを1件投稿すると、<strong>1か月間</strong>すべての口コミを閲覧できます</li>
          <li>購入証明の提出は任意です（提出で「購入証明済み」バッジ）</li>
          <li>入力途中の内容は<strong>一時保存</strong>でき、次回アクセス時に自動で復元されます（購入証明ファイルは除く）</li>
          <li>口コミ本文は「受講前の状態 → 受講後の変化 → おすすめできる人」が伝わるよう記載してください（良かった点は<strong>最低100文字</strong>、受講前・受講後の変化・おすすめしたい人は<strong>最低50文字</strong>、気になった点は<strong>最低30文字</strong>）</li>
        </ul>
        <a href="submit-guidelines.html" class="sr-side-guide-link">口コミ投稿ガイドラインを見る →</a>
      </div>
      <div class="sr-side-box">
        <h3>評価の基準</h3>
        <div class="sr-scale-list">${renderRatingScale()}</div>
        <p class="sr-side-note">0.5刻みで評価できます（星を左半分クリックで半分）</p>
      </div>
      <div class="sr-side-box">
        <h3>投稿内容の公開について</h3>
        <ul class="sr-side-list">
          <li>口コミ本文は<strong>匿名</strong>（ニックネーム）で公開されます</li>
          <li>購入証明は<strong>モザイク処理</strong>され、氏名・住所・電話番号・メールアドレスなどの個人情報は公開されません</li>
          <li>内容は運営が確認し、承認後に掲載されます</li>
          <li>個人を特定できる記述や誹謗中傷は削除対象です</li>
        </ul>
      </div>
      <div class="sr-side-box sr-side-box--help">
        <h3>困ったときは？</h3>
        <p>投稿方法や評価基準でわからないことがあれば、以下をご確認ください。</p>
        <a href="faq.html" class="sr-side-link">Q&Aを見る</a>
        <a href="contact.html" class="sr-side-link">お問い合わせ</a>
        <a href="guide.html" class="sr-side-link">ご利用ガイド</a>
      </div>
    </aside>`;
}

function getReviewDraftStorageKey() {
  const userId = window.Auth?.getUser?.()?.id;
  return userId ? `review-draft-v${REVIEW_DRAFT_VERSION}-${userId}` : "review-draft-v1-guest";
}

function collectDraftSnapshot() {
  const refundEl = document.querySelector('input[name="hasRefundGuarantee"]:checked');
  const snapshot = {
    serviceName: document.getElementById("serviceName")?.value || "",
    sellerName: document.getElementById("sellerName")?.value || "",
    purchasePrice: document.getElementById("purchasePrice")?.value || "",
    purchaseYear: document.getElementById("purchaseYear")?.value || "",
    hasRefundGuarantee: refundEl?.value || "",
    ratings: Object.fromEntries(
      RATING_ITEMS.map((item) => [item.key, document.getElementById(item.key)?.value || ""])
    ),
    bodies: Object.fromEntries(
      BODY_ITEMS.map((item) => [item.id, document.getElementById(item.id)?.value || ""])
    ),
  };
  return snapshot;
}

function isDraftSnapshotEmpty(snapshot) {
  if (!snapshot) return true;
  if (snapshot.serviceName?.trim()) return false;
  if (snapshot.sellerName?.trim()) return false;
  if (snapshot.purchasePrice?.trim()) return false;
  if (snapshot.purchaseYear) return false;
  if (snapshot.hasRefundGuarantee) return false;
  if (Object.values(snapshot.ratings || {}).some((v) => Number(v) > 0)) return false;
  return !Object.values(snapshot.bodies || {}).some((v) => String(v || "").trim());
}

function formatDraftSavedAt(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

function updateDraftStatusUI(savedAt, { restored = false } = {}) {
  const statusEl = document.getElementById("sr-draft-status");
  const clearBtn = document.getElementById("sr-draft-clear");
  if (!statusEl) return;

  if (!savedAt) {
    statusEl.hidden = true;
    statusEl.textContent = "";
    clearBtn?.classList.add("hidden");
    return;
  }

  const label = formatDraftSavedAt(savedAt);
  statusEl.hidden = false;
  statusEl.textContent = restored
    ? `下書きを復元しました（${label} 保存）`
    : `${label} に一時保存しました`;
  clearBtn?.classList.remove("hidden");
}

function saveReviewDraft({ silent = false, restored = false } = {}) {
  const snapshot = collectDraftSnapshot();
  if (isDraftSnapshotEmpty(snapshot)) {
    if (!silent) {
      window.App?.showToast?.("保存する内容がありません", "error");
    }
    return false;
  }

  const savedAt = new Date().toISOString();
  const payload = {
    version: REVIEW_DRAFT_VERSION,
    savedAt,
    data: snapshot,
  };

  try {
    localStorage.setItem(getReviewDraftStorageKey(), JSON.stringify(payload));
    updateDraftStatusUI(savedAt, { restored });
    if (!silent && !restored) {
      window.App?.showToast?.("入力内容を一時保存しました");
    }
    return true;
  } catch (err) {
    if (!silent) {
      window.App?.showToast?.("一時保存に失敗しました。ブラウザの保存容量を確認してください。", "error");
    }
    console.warn("[カウマエ] 口コミ下書き保存エラー", err);
    return false;
  }
}

function loadReviewDraft() {
  try {
    const raw = localStorage.getItem(getReviewDraftStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== REVIEW_DRAFT_VERSION || !parsed.data) return null;
    if (isDraftSnapshotEmpty(parsed.data)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearReviewDraft() {
  localStorage.removeItem(getReviewDraftStorageKey());
  updateDraftStatusUI(null);
}

function setRatingDisplay(ratingKey, value) {
  const container = document.querySelector(`.sr-stars[data-rating-name="${ratingKey}"]`);
  const hidden = document.getElementById(ratingKey);
  if (!container || !hidden) return;

  const num = Number(value) || 0;
  container.querySelectorAll(".sr-star").forEach((btn) => {
    const star = Number(btn.dataset.star);
    btn.classList.toggle("is-half", num >= star - 0.5 && num < star);
    btn.classList.toggle("is-full", num >= star);
  });
  hidden.value = num || "";
}

function applyReviewDraft(draft) {
  const data = draft?.data;
  if (!data) return false;

  const serviceName = document.getElementById("serviceName");
  const sellerName = document.getElementById("sellerName");
  const purchasePrice = document.getElementById("purchasePrice");
  const purchaseYear = document.getElementById("purchaseYear");

  if (serviceName) serviceName.value = data.serviceName || "";
  if (sellerName) sellerName.value = data.sellerName || "";
  if (purchasePrice) purchasePrice.value = data.purchasePrice || "";
  if (purchaseYear) purchaseYear.value = data.purchaseYear || "";

  if (data.hasRefundGuarantee) {
    const refundInput = document.querySelector(
      `input[name="hasRefundGuarantee"][value="${data.hasRefundGuarantee}"]`
    );
    if (refundInput) refundInput.checked = true;
  }

  RATING_ITEMS.forEach((item) => {
    setRatingDisplay(item.key, data.ratings?.[item.key] || 0);
  });

  BODY_ITEMS.forEach((item) => {
    const textarea = document.getElementById(item.id);
    if (!textarea) return;
    textarea.value = data.bodies?.[item.id] || "";
    updateTextareaState(textarea);
  });

  validateForm();
  updateDraftStatusUI(draft.savedAt, { restored: true });
  return true;
}

function scheduleDraftAutosave() {
  if (draftSaveTimer) window.clearTimeout(draftSaveTimer);
  draftSaveTimer = window.setTimeout(() => {
    saveReviewDraft({ silent: true });
  }, REVIEW_DRAFT_DEBOUNCE_MS);
}

function initDraftFeature() {
  const saveBtn = document.getElementById("sr-draft-save");
  const clearBtn = document.getElementById("sr-draft-clear");
  const form = document.getElementById("review-form");
  if (!form) return;

  const existing = loadReviewDraft();
  if (existing) {
    applyReviewDraft(existing);
    window.App?.showToast?.("前回の下書きを復元しました");
  }

  saveBtn?.addEventListener("click", () => {
    saveReviewDraft({ silent: false });
  });

  clearBtn?.addEventListener("click", () => {
    if (!loadReviewDraft()) return;
    if (!window.confirm("保存した下書きを削除しますか？")) return;
    clearReviewDraft();
    window.App?.showToast?.("下書きを削除しました");
  });

  form
    .querySelectorAll(
      "#serviceName, #sellerName, #purchasePrice, #purchaseYear, .sr-textarea, input[name='hasRefundGuarantee']"
    )
    .forEach((el) => {
      el.addEventListener("input", scheduleDraftAutosave);
      el.addEventListener("change", scheduleDraftAutosave);
    });

  document.querySelectorAll(".sr-stars .sr-star").forEach((btn) => {
    btn.addEventListener("click", scheduleDraftAutosave);
  });
}

function collectFormData() {
  const proofInput = document.getElementById("purchaseProof");
  const year = document.getElementById("purchaseYear")?.value;

  const refundEl = document.querySelector('input[name="hasRefundGuarantee"]:checked');

  return {
    serviceName: document.getElementById("serviceName")?.value.trim() || "",
    sellerName: document.getElementById("sellerName")?.value.trim() || "",
    productName: document.getElementById("serviceName")?.value.trim() || "",
    hasRefundGuarantee: refundEl?.value || "",
    purchasePrice: document.getElementById("purchasePrice")?.value || "",
    purchasePeriod: year ? `${year}年頃` : "",
    purchaseProofName: proofInput?.files?.[0]?.name || "",
    purchaseProofAttached: Boolean(proofInput?.files?.[0]),
    purchaseProofKind: getProofFileMeta(proofInput?.files?.[0])?.kindLabel || "",
    purchaseProofSize: proofInput?.files?.[0] ? formatProofFileSize(proofInput.files[0].size) : "",
    ratings: RATING_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      value: Number(document.getElementById(item.key)?.value || 0),
    })),
    bodies: BODY_ITEMS.map((item) => ({
      id: item.id,
      label: item.label,
      text: document.getElementById(item.id)?.value.trim() || "",
    })),
  };
}

function renderConfirmScreen(data) {
  return `
    <section class="sr-confirm" id="sr-confirm" aria-labelledby="sr-confirm-title">
      <div class="sr-confirm-card">
        <h2 id="sr-confirm-title">本当にこの内容で投稿してよろしいですか？</h2>
        <p class="sr-confirm-lead">投稿前に入力内容をご確認ください。</p>

        <div class="sr-confirm-block">
          <h3>購入情報</h3>
          <dl class="sr-confirm-dl">
            <div><dt>サービス名</dt><dd>${App.escapeHtml(data.serviceName)}</dd></div>
            <div><dt>チャンネル・企業名</dt><dd>${App.escapeHtml(data.sellerName)}</dd></div>
            <div><dt>購入価格</dt><dd>${App.escapeHtml(Number(data.purchasePrice).toLocaleString())}円</dd></div>
            <div><dt>購入時期</dt><dd>${App.escapeHtml(data.purchasePeriod)}</dd></div>
            <div><dt>返金保証</dt><dd>${App.escapeHtml(refundGuaranteeLabel(data.hasRefundGuarantee))}</dd></div>
            <div><dt>購入証明</dt><dd>${renderConfirmProofSummary(data)}</dd></div>
          </dl>
        </div>

        <div class="sr-confirm-block">
          <h3>評価</h3>
          <dl class="sr-confirm-dl sr-confirm-dl--ratings">
            ${data.ratings
              .map(
                (r) =>
                  `<div><dt>${App.escapeHtml(r.label)}</dt><dd class="sr-confirm-stars">${formatRatingStars(r.value)}</dd></div>`
              )
              .join("")}
          </dl>
        </div>

        <div class="sr-confirm-block">
          <h3>口コミ本文</h3>
          ${data.bodies
            .filter((b) => b.text)
            .map(
              (b) => `
            <div class="sr-confirm-body-item">
              <h4>${App.escapeHtml(b.label)}</h4>
              <p class="sr-confirm-body-text">${App.escapeHtml(b.text).replace(/\n/g, "<br>")}</p>
            </div>`
            )
            .join("")}
        </div>

        <div class="sr-confirm-actions">
          <button type="button" class="btn btn-outline-trust btn-lg" id="sr-confirm-back">戻って修正する</button>
          <button type="button" class="btn btn-trust btn-lg" id="sr-confirm-submit">この内容で投稿する</button>
        </div>
      </div>
    </section>`;
}

function showConfirmScreen() {
  const form = document.getElementById("review-form");
  const data = collectFormData();
  let confirm = document.getElementById("sr-confirm");

  if (!confirm) {
    form.insertAdjacentHTML("beforeend", renderConfirmScreen(data));
    confirm = document.getElementById("sr-confirm");
    document.getElementById("sr-confirm-back").addEventListener("click", hideConfirmScreen);
    document.getElementById("sr-confirm-submit").addEventListener("click", submitReview);
  } else {
    confirm.outerHTML = renderConfirmScreen(data);
    confirm = document.getElementById("sr-confirm");
    document.getElementById("sr-confirm-back").addEventListener("click", hideConfirmScreen);
    document.getElementById("sr-confirm-submit").addEventListener("click", submitReview);
  }

  form.querySelector(".sr-layout").classList.add("hidden");
  form.querySelector(".sr-actions").classList.add("hidden");
  form.querySelector(".sr-footer-note")?.classList.add("hidden");
  confirm.classList.remove("hidden");
  confirm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideConfirmScreen() {
  const form = document.getElementById("review-form");
  document.getElementById("sr-confirm")?.classList.add("hidden");
  form.querySelector(".sr-layout")?.classList.remove("hidden");
  form.querySelector(".sr-actions")?.classList.remove("hidden");
  form.querySelector(".sr-footer-note")?.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function submitReview() {
  const submitBtn = document.getElementById("sr-confirm-submit");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "送信中...";
  }

  try {
    const data = collectFormData();
    const proofFile = document.getElementById("purchaseProof")?.files?.[0] || null;
    const result = await ReviewsApi.submitReview(data, proofFile);
    if (result.readUnlockApproved) {
      App.showToast("口コミを送信しました。内容を確認し、他の口コミ全文を閲覧できるようになりました。");
    } else {
      App.showToast(
        "口コミを送信しました。内容を運営が確認後、全文閲覧が解除されます。公開は別途審査後です。",
        "success"
      );
    }
    clearReviewDraft();
    setTimeout(() => (window.location.href = "my-reviews.html"), 1400);
  } catch (err) {
    App.showToast(err.message || "投稿に失敗しました", "error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "この内容で投稿する";
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await App.whenReady();

  App.renderBreadcrumb([
    { label: "トップ", path: "index.html" },
    { label: "口コミを投稿" },
  ]);

  const root = document.getElementById("submit-root");

  if (!App.isLoggedIn()) {
    root.innerHTML = `
      <div class="sr-login-card">
        <div class="sr-login-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <rect x="5" y="11" width="14" height="10" rx="2"/>
            <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
          </svg>
        </div>
        <h1>口コミを投稿するにはログインが必要です</h1>
        <p class="sr-login-lead">
          アカウントを作成またはログインして、口コミを投稿しましょう。<br />
          口コミを投稿すると、すべての口コミを無料で閲覧できるようになります。
        </p>
        <div class="sr-login-actions">
          <a href="register.html" class="btn btn-trust btn-lg">新規登録</a>
          <a href="login.html?redirect=submit-review.html" class="btn btn-outline-trust btn-lg">ログイン</a>
        </div>
        <p class="sr-login-back"><a href="index.html" class="back-link">トップページに戻る</a></p>
      </div>`;
    return;
  }

  root.innerHTML = `
    <header class="sr-header">
      <h1>口コミを投稿する</h1>
      <p>購入した商品・サービスの口コミを投稿すると、1か月間すべての口コミを無料で閲覧できます</p>
    </header>

    <form id="review-form" class="sr-form" novalidate>
      <div class="sr-layout">
        <div class="sr-main-col">
          <section class="sr-panel sr-panel--info">
            <header class="sr-panel-head">
              <h2>購入情報</h2>
              <p>購入した商品・サービスについて入力してください</p>
            </header>
            <div class="sr-panel-body sr-info-grid">
              <div class="form-group">
                <label class="form-label" for="serviceName">サービス名 <span class="sr-required">*</span></label>
                <input type="text" class="form-input" id="serviceName" required
                  placeholder="例: YouTubeで月収100万円を達成する完全ロードマップ" />
                <p class="form-hint">講座名・商品名・サービス名を入力してください</p>
              </div>
              <div class="form-group">
                <label class="form-label" for="sellerName">チャンネル・企業名 <span class="sr-required">*</span></label>
                <input type="text" class="form-input" id="sellerName" required
                  placeholder="例: ○○チャンネル / 株式会社△△ / 山田太郎" />
                <p class="form-hint">YouTubeチャンネル名、販売会社名、講師名などを入力してください</p>
              </div>
              <div class="form-group">
                <label class="form-label" for="purchasePrice">購入価格（円） <span class="sr-required">*</span></label>
                <input type="number" class="form-input" id="purchasePrice" required min="0" placeholder="98000" />
              </div>
              <div class="form-group sr-info-period">
                <span class="form-label">購入時期 <span class="sr-required">*</span></span>
                ${renderPurchasePeriodFields()}
              </div>
              ${renderRefundGuaranteeField()}
              <div class="form-group sr-info-proof">
                <div class="sr-proof-head">
                  <label class="form-label" for="purchaseProof">購入証明 <span class="sr-proof-optional">任意</span></label>
                  <span class="sr-proof-status-badge sr-proof-status-badge--empty" id="purchaseProof-status">未添付</span>
                </div>
                <p class="form-hint sr-proof-hint">領収書・契約画面・決済メールなど（JPEG / PNG / WebP / PDF · 10MBまで）</p>
                <div class="sr-proof-upload" id="purchaseProof-upload">
                  <label class="sr-proof-dropzone" id="purchaseProof-dropzone" for="purchaseProof">
                    <span class="sr-proof-dropzone-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                        <path d="M12 16V4m0 0 7 7m-7-7 7 7"/>
                        <path d="M4 20h16"/>
                      </svg>
                    </span>
                    <span class="sr-proof-dropzone-title">クリックしてファイルを選択</span>
                    <span class="sr-proof-dropzone-hint">またはここにドラッグ＆ドロップ</span>
                    <span class="sr-proof-dropzone-types">対応形式: 画像（JPG / PNG / WebP）· PDF</span>
                  </label>
                  <div class="sr-proof-attached hidden" id="purchaseProof-attached" aria-live="polite">
                    <div class="sr-proof-file-card">
                      <div class="sr-proof-thumb" id="purchaseProof-thumb" aria-hidden="true"></div>
                      <div class="sr-proof-file-info">
                        <span class="sr-proof-type" id="purchaseProof-type">—</span>
                        <strong class="sr-proof-filename" id="purchaseProof-filename">—</strong>
                        <span class="sr-proof-size" id="purchaseProof-size">—</span>
                      </div>
                      <button type="button" class="sr-proof-remove" id="purchaseProof-remove" aria-label="添付を解除">×</button>
                    </div>
                    <div class="sr-proof-actions">
                      <label class="btn btn-sm btn-outline" for="purchaseProof">別のファイルを選ぶ</label>
                    </div>
                  </div>
                  <p class="sr-proof-error hidden" id="purchaseProof-error" role="alert"></p>
                  <input type="file" class="sr-upload-input" id="purchaseProof" accept="${PROOF_ACCEPT}" />
                </div>
              </div>
            </div>
          </section>

          <section class="sr-panel sr-panel--main">
            <header class="sr-panel-head">
              <h2>詳細レビュー</h2>
              <p>5つの項目について、まず星で評価し、その後に口コミ本文を入力してください</p>
            </header>
            <div class="sr-panel-body">
              <div class="sr-subsection">
                <h3 class="sr-subsection-title">評価 <span class="sr-required">*</span></h3>
                <p class="form-hint sr-rating-intro">5項目すべて星評価が必須です（0.5刻み可）</p>
                <div class="sr-rating-list">${renderRatingRows()}</div>
              </div>
              <div class="sr-subsection sr-subsection--body">
                <h3 class="sr-subsection-title">口コミ本文</h3>
                <div class="sr-body-list">${renderBodyRows()}</div>
              </div>
            </div>
          </section>
        </div>
        ${renderSidebar()}
      </div>

      <div id="sr-validation-errors" class="sr-validation-errors hidden" role="alert" aria-live="polite"></div>
      <p class="sr-draft-status" id="sr-draft-status" hidden></p>
      <div class="sr-actions">
        <button type="submit" class="btn btn-trust btn-lg sr-submit-btn" id="submit-btn" disabled>
          入力内容を確認する
        </button>
        <button type="button" class="btn btn-outline-trust btn-lg" id="sr-draft-save">一時保存</button>
        <button type="button" class="btn btn-ghost btn-lg sr-draft-clear hidden" id="sr-draft-clear">下書きを削除</button>
      </div>
      <p class="sr-footer-note">
        投稿された口コミは運営が確認のうえ公開されます。審査状況は<a href="my-reviews.html">投稿した口コミ</a>から確認できます。投稿は匿名で行われます。
      </p>
    </form>
  `;

  initFileUpload();
  initStarRatings();
  initCharCounters();
  initFormValidation();
  initDraftFeature();
});

function formatProofFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getProofFileMeta(file) {
  if (!file) return null;

  const name = file.name || "ファイル";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const mime = (file.type || "").toLowerCase();

  if (mime === "application/pdf" || ext === "pdf") {
    return { kind: "pdf", kindLabel: "PDF", ext: "PDF" };
  }
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    const extLabel = ext ? ext.toUpperCase() : "画像";
    return { kind: "image", kindLabel: "画像", ext: extLabel };
  }
  return { kind: "file", kindLabel: "ファイル", ext: ext.toUpperCase() || "—" };
}

function isProofFileAllowed(file) {
  const meta = getProofFileMeta(file);
  return meta?.kind === "pdf" || meta?.kind === "image";
}

function renderProofThumbHtml(file, meta) {
  if (meta.kind === "image") {
    revokeProofPreview();
    proofPreviewUrl = URL.createObjectURL(file);
    return `<img src="${proofPreviewUrl}" alt="" class="sr-proof-thumb-img" />`;
  }
  if (meta.kind === "pdf") {
    return `<span class="sr-proof-thumb-pdf">PDF</span>`;
  }
  return `<span class="sr-proof-thumb-file">FILE</span>`;
}

function renderConfirmProofSummary(data) {
  if (!data.purchaseProofAttached) {
    return `<span class="sr-confirm-proof sr-confirm-proof--no">未提出</span>`;
  }
  const kind = data.purchaseProofKind || "ファイル";
  const size = data.purchaseProofSize ? ` · ${data.purchaseProofSize}` : "";
  return `<span class="sr-confirm-proof sr-confirm-proof--yes">添付済み</span>
    <span class="sr-confirm-proof-name">${App.escapeHtml(data.purchaseProofName)}</span>
    <span class="sr-confirm-proof-meta">（${App.escapeHtml(kind)}${App.escapeHtml(size)}）</span>`;
}

function revokeProofPreview() {
  if (proofPreviewUrl) {
    URL.revokeObjectURL(proofPreviewUrl);
    proofPreviewUrl = null;
  }
}

function showProofError(message) {
  const errorEl = document.getElementById("purchaseProof-error");
  if (!errorEl) return;
  if (message) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  } else {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }
}

function clearProofAttachment() {
  const input = document.getElementById("purchaseProof");
  if (input) input.value = "";
  revokeProofPreview();
  updateProofUploadUI(null);
}

function updateProofUploadUI(file) {
  const dropzone = document.getElementById("purchaseProof-dropzone");
  const attached = document.getElementById("purchaseProof-attached");
  const statusEl = document.getElementById("purchaseProof-status");
  const typeEl = document.getElementById("purchaseProof-type");
  const nameEl = document.getElementById("purchaseProof-filename");
  const sizeEl = document.getElementById("purchaseProof-size");
  const thumbEl = document.getElementById("purchaseProof-thumb");
  const uploadRoot = document.getElementById("purchaseProof-upload");

  if (!dropzone || !attached || !statusEl) return;

  if (!file) {
    dropzone.classList.remove("hidden");
    attached.classList.add("hidden");
    uploadRoot?.classList.remove("is-attached");
    statusEl.textContent = "未添付";
    statusEl.className = "sr-proof-status-badge sr-proof-status-badge--empty";
    if (thumbEl) thumbEl.innerHTML = "";
    return;
  }

  const meta = getProofFileMeta(file);

  dropzone.classList.add("hidden");
  attached.classList.remove("hidden");
  uploadRoot?.classList.add("is-attached");

  statusEl.textContent = "添付済み";
  statusEl.className = "sr-proof-status-badge sr-proof-status-badge--attached";

  if (typeEl) typeEl.textContent = `${meta.kindLabel}（${meta.ext}）`;
  if (nameEl) {
    nameEl.textContent = file.name;
    nameEl.title = file.name;
  }
  if (sizeEl) sizeEl.textContent = formatProofFileSize(file.size);
  if (thumbEl) thumbEl.innerHTML = renderProofThumbHtml(file, meta);
}

function applyProofFile(file) {
  const input = document.getElementById("purchaseProof");
  if (!file) {
    clearProofAttachment();
    return;
  }

  showProofError("");

  if (!isProofFileAllowed(file)) {
    showProofError("JPEG / PNG / WebP / PDF のみ添付できます。");
    if (input) input.value = "";
    updateProofUploadUI(null);
    return;
  }

  if (file.size > PROOF_MAX_BYTES) {
    showProofError(`ファイルサイズが大きすぎます（上限 ${formatProofFileSize(PROOF_MAX_BYTES)}）。`);
    if (input) input.value = "";
    updateProofUploadUI(null);
    return;
  }

  updateProofUploadUI(file);
}

function initFileUpload() {
  const input = document.getElementById("purchaseProof");
  const uploadRoot = document.getElementById("purchaseProof-upload");
  const removeBtn = document.getElementById("purchaseProof-remove");
  if (!input) return;

  input.addEventListener("change", () => {
    const file = input.files?.[0] || null;
    applyProofFile(file);
  });

  removeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    clearProofAttachment();
    showProofError("");
  });

  if (!uploadRoot) return;

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadRoot.addEventListener(eventName, (e) => {
      e.preventDefault();
      uploadRoot.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadRoot.addEventListener(eventName, (e) => {
      e.preventDefault();
      uploadRoot.classList.remove("is-dragover");
    });
  });

  uploadRoot.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0] || null;
    if (!file) return;

    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    applyProofFile(file);
  });

  updateProofUploadUI(null);
}

function initStarRatings() {
  document.querySelectorAll(".sr-stars").forEach((container) => {
    const name = container.dataset.ratingName;
    const hidden = document.getElementById(name);
    if (!hidden) return;

    const updateDisplay = (value) => {
      setRatingDisplay(name, value);
      validateForm();
    };

    container.querySelectorAll(".sr-star").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const star = Number(btn.dataset.star);
        const rect = btn.getBoundingClientRect();
        const isLeftHalf = e.clientX - rect.left < rect.width / 2;
        updateDisplay(isLeftHalf ? star - 0.5 : star);
      });
    });

    updateDisplay(0);
  });
}

function updateTextareaState(textarea) {
  const item = getBodyItem(textarea.id);
  const minChars = Number(textarea.dataset.minChars || 0);
  const required = textarea.dataset.required === "true";
  const countEl = document.getElementById(`${textarea.id}-count`);
  const qualityEl = document.getElementById(`${textarea.id}-quality`);
  const len = countChars(textarea.value);
  const remaining = Math.max(0, minChars - len);
  const lowQuality =
    required && len >= minChars && isLowQualityText(textarea.value, minChars);

  if (countEl) {
    if (!required) {
      countEl.textContent = len > 0 ? `${len}文字（任意）` : "0文字（任意）";
      countEl.classList.remove("is-valid", "is-invalid");
    } else {
      countEl.textContent =
        remaining > 0
          ? `${len} / ${minChars}文字（あと${remaining}文字）`
          : `${len} / ${minChars}文字（達成済み）`;
      countEl.classList.toggle("is-valid", len >= minChars && !lowQuality);
      countEl.classList.toggle("is-invalid", len < minChars || lowQuality);
    }
  }

  if (qualityEl) {
    qualityEl.classList.toggle("hidden", !lowQuality);
  }

  textarea.classList.toggle("sr-textarea--invalid", lowQuality);
  void item;
}

function initCharCounters() {
  document.querySelectorAll(".sr-textarea[data-min-chars]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      updateTextareaState(textarea);
      validateForm();
    });
    updateTextareaState(textarea);
  });
}

function getQualityInvalidFields() {
  return REQUIRED_BODY_ITEMS.filter((item) => {
    const text = document.getElementById(item.id)?.value || "";
    const minChars = getMinCharsForItem(item);
    return countChars(text) >= minChars && isLowQualityText(text, minChars);
  });
}

function collectValidationErrors() {
  const errors = [];
  const serviceName = document.getElementById("serviceName")?.value.trim();
  const sellerName = document.getElementById("sellerName")?.value.trim();
  const hasRefundGuarantee = document.querySelector('input[name="hasRefundGuarantee"]:checked')?.value;
  const purchasePrice = document.getElementById("purchasePrice")?.value;
  const purchaseYear = document.getElementById("purchaseYear")?.value;

  if (!serviceName) errors.push("サービス名を入力してください");
  if (!sellerName) errors.push("チャンネル・企業名を入力してください");
  if (!hasRefundGuarantee) errors.push("返金保証の有無を選択してください");
  if (purchasePrice === "" || Number(purchasePrice) < 0) errors.push("購入価格を入力してください");
  if (!purchaseYear) errors.push("購入年を選択してください");

  RATING_ITEMS.forEach((item) => {
    if (!Number(document.getElementById(item.key)?.value || 0)) {
      errors.push(`${item.label}の評価を入力してください`);
    }
  });

  REQUIRED_BODY_ITEMS.forEach((item) => {
    const minChars = getMinCharsForItem(item);
    const text = document.getElementById(item.id)?.value || "";
    const len = countChars(text);
    const label = item.shortLabel || item.label;
    if (len < minChars) {
      errors.push(`${label}が${minChars}文字未満です`);
    } else if (isLowQualityText(text, minChars)) {
      errors.push(`${label}の内容が適切ではありません。具体的な体験を記載してください`);
    }
  });

  return errors;
}

function renderValidationErrors(errors) {
  const box = document.getElementById("sr-validation-errors");
  if (!box) return;
  if (!errors.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = `
    <p class="sr-validation-errors-title">入力内容を確認してください</p>
    <ul class="sr-validation-errors-list">
      ${errors.map((msg) => `<li>${App.escapeHtml(msg)}</li>`).join("")}
    </ul>`;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function validateForm(showErrors = false) {
  const submitBtn = document.getElementById("submit-btn");
  if (!submitBtn) return false;

  const errors = collectValidationErrors();
  const isValid = errors.length === 0;

  submitBtn.disabled = !isValid;

  if (showErrors) {
    renderValidationErrors(errors);
    if (errors.length) return false;
  } else {
    renderValidationErrors([]);
  }

  return isValid;
}

function initFormValidation() {
  const form = document.getElementById("review-form");
  form
    .querySelectorAll("#serviceName, #sellerName, #purchasePrice, #purchaseYear, .sr-textarea, input[name='hasRefundGuarantee']")
    .forEach((el) => {
      el.addEventListener("input", () => validateForm());
      el.addEventListener("change", () => validateForm());
    });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validateForm(true)) return;
    renderValidationErrors([]);
    showConfirmScreen();
  });

  validateForm();
}
