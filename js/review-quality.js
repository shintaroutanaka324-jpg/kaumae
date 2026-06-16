(function () {
  const REQUIRED_FIELDS = [
    { key: "body_pros", label: "良かった点・満足した点", minChars: 100 },
    { key: "body_concerns", label: "気になった点・改善してほしい点", minChars: 30 },
    { key: "body_before", label: "受講前・利用前の状態", minChars: 50 },
    { key: "body_results", label: "受講後・利用後の変化", minChars: 50 },
    { key: "body_recommend", label: "どんな人におすすめしたいか", minChars: 50 },
  ];

  const PROMO_PATTERNS = [
    /line\s*登録/i,
    /公式ライン/i,
    /限定募集/i,
    /絶対儲かる/i,
    /必ず稼げ/i,
    /100%成功/i,
    /誰でも簡単に/i,
    /クリックして/i,
    /今すぐ申し込/i,
    /紹介コード/i,
    /アフィリエイト/i,
  ];

  const PERSONAL_INFO_PATTERNS = [
    /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/,
    /0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/,
    /〒?\d{3}-?\d{4}/,
    /\d{7,}/,
  ];

  function countChars(value) {
    return [...String(value || "")].length;
  }

  function normalizeCompact(text) {
    return String(text || "")
      .trim()
      .replace(/\s+/g, "");
  }

  function latinLetterRatio(text) {
    const chars = [...normalizeCompact(text)];
    if (!chars.length) return 0;
    const latin = chars.filter((c) => /[a-zA-Z]/.test(c)).length;
    return latin / chars.length;
  }

  function japaneseScriptRatio(text) {
    const chars = [...normalizeCompact(text)];
    if (!chars.length) return 0;
    const jp = chars.filter((c) => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(c)).length;
    return jp / chars.length;
  }

  function countLongLatinRuns(text) {
    return (String(text || "").match(/[a-zA-Z]{6,}/g) || []).length;
  }

  function hasReadableJapaneseClause(text) {
    return /[ぁ-んァ-ヶ一-龯]{8,}/u.test(String(text || ""));
  }

  function isGibberishText(text, minChars = 50) {
    const trimmed = String(text || "").trim();
    if (countChars(trimmed) < minChars) return false;

    const latinRatio = latinLetterRatio(trimmed);
    const jpRatio = japaneseScriptRatio(trimmed);
    const longLatinRuns = countLongLatinRuns(trimmed);

    if (longLatinRuns >= 2 && latinRatio > 0.25) return true;
    if (latinRatio > 0.45) return true;
    if (jpRatio < 0.2 && countChars(trimmed) >= 80) return true;
    if (!hasReadableJapaneseClause(trimmed) && countChars(trimmed) >= minChars) return true;

    const digitRatio = [...normalizeCompact(trimmed)].filter((c) => /\d/.test(c)).length / normalizeCompact(trimmed).length;
    if (digitRatio > 0.15 && latinRatio > 0.15) return true;

    return false;
  }

  function isLowQualityText(text, minChars = 50) {
    const trimmed = String(text || "").trim();
    if (countChars(trimmed) < minChars) return false;

    if (isGibberishText(trimmed, minChars)) return true;

    const compact = normalizeCompact(trimmed);
    if (!compact) return true;

    const chars = [...compact];
    const freq = {};
    for (const c of chars) freq[c] = (freq[c] || 0) + 1;
    const maxFreq = Math.max(...Object.values(freq));
    if (maxFreq / chars.length > 0.35) return true;

    const unique = new Set(chars).size;
    if (unique < 10) return true;
    if (unique / chars.length < 0.1) return true;

    for (let len = 1; len <= 6; len++) {
      const unit = compact.slice(0, len);
      if (unit && compact === unit.repeat(Math.ceil(compact.length / len)).slice(0, compact.length)) {
        return true;
      }
    }

    const words = trimmed.split(/[\s　、。.\n]+/).filter((w) => w.length >= 2);
    if (words.length >= 3) {
      const wordFreq = {};
      for (const w of words) wordFreq[w] = (wordFreq[w] || 0) + 1;
      const maxWord = Math.max(...Object.values(wordFreq));
      if (maxWord / words.length > 0.5 && words.length >= 5) return true;
    }

    return false;
  }

  function hasPersonalInfo(text) {
    return PERSONAL_INFO_PATTERNS.some((re) => re.test(String(text || "")));
  }

  function countUrls(text) {
    const matches = String(text || "").match(/https?:\/\/|www\./gi);
    return matches ? matches.length : 0;
  }

  function hasPromoSpam(text) {
    return PROMO_PATTERNS.some((re) => re.test(String(text || "")));
  }

  function symbolRatio(text) {
    const chars = [...String(text || "").replace(/\s+/g, "")];
    if (!chars.length) return 0;
    const symbols = chars.filter((c) => !/[\p{L}\p{N}]/u.test(c)).length;
    return symbols / chars.length;
  }

  function similarityRatio(a, b) {
    const x = normalizeCompact(a);
    const y = normalizeCompact(b);
    if (!x || !y) return 0;
    if (x === y) return 1;
    const shorter = x.length < y.length ? x : y;
    const longer = x.length < y.length ? y : x;
    if (longer.includes(shorter) && shorter.length / longer.length > 0.7) {
      return shorter.length / longer.length;
    }
    return 0;
  }

  function getBodyValue(bodies, key) {
    if (key === "body_before") return bodies.body_before || bodies.body_situation || "";
    if (key === "body_results") return bodies.body_results || bodies.body_learnings || "";
    return bodies[key] || "";
  }

  function evaluateReviewBodies(bodies) {
    const reasons = [];
    const texts = {};

    REQUIRED_FIELDS.forEach((field) => {
      const text = getBodyValue(bodies, field.key).trim();
      texts[field.key] = text;

      if (countChars(text) < field.minChars) {
        reasons.push({
          field: field.key,
          code: "too_short",
          message: `${field.label}が${field.minChars}文字未満です`,
        });
        return;
      }

      if (isLowQualityText(text, field.minChars)) {
        const gibberish = isGibberishText(text, field.minChars);
        reasons.push({
          field: field.key,
          code: gibberish ? "gibberish" : "low_quality",
          message: gibberish
            ? `${field.label}が意味のない文字列・適当な入力と判断されました`
            : `${field.label}の内容が具体性に欠けています（同じ文字の繰り返しなど）`,
        });
      }

      if (hasPersonalInfo(text)) {
        reasons.push({
          field: field.key,
          code: "personal_info",
          message: `${field.label}に個人情報（メール・電話番号など）が含まれています`,
        });
      }

      if (hasPromoSpam(text)) {
        reasons.push({
          field: field.key,
          code: "promo_spam",
          message: `${field.label}に宣伝・勧誘と思われる表現が含まれています`,
        });
      }

      if (symbolRatio(text) > 0.28) {
        reasons.push({
          field: field.key,
          code: "symbol_heavy",
          message: `${field.label}の記号・装飾が多すぎます`,
        });
      }
    });

    const combined = REQUIRED_FIELDS.map((f) => texts[f.key]).join("\n");
    if (countUrls(combined) > 2) {
      reasons.push({
        field: "_all",
        code: "too_many_urls",
        message: "URLの記載が多すぎます",
      });
    }

    const sentenceCount = (combined.match(/[。！？!?]/g) || []).length;
    if (sentenceCount < 4) {
      reasons.push({
        field: "_all",
        code: "few_sentences",
        message: "文章の区切りが少なく、読みづらい内容です",
      });
    }

    for (let i = 0; i < REQUIRED_FIELDS.length; i++) {
      for (let j = i + 1; j < REQUIRED_FIELDS.length; j++) {
        const a = REQUIRED_FIELDS[i];
        const b = REQUIRED_FIELDS[j];
        if (similarityRatio(texts[a.key], texts[b.key]) >= 0.72) {
          reasons.push({
            field: b.key,
            code: "duplicate_field",
            message: `${a.label}と${b.label}の内容がほぼ同じです`,
          });
        }
      }
    }

    const uniqueTexts = new Set(REQUIRED_FIELDS.map((f) => normalizeCompact(texts[f.key])).filter(Boolean));
    if (uniqueTexts.size <= 2) {
      reasons.push({
        field: "_all",
        code: "fields_too_similar",
        message: "各項目の内容が十分に分かれていません",
      });
    }

    const deduped = [];
    const seen = new Set();
    for (const r of reasons) {
      const id = `${r.field}:${r.code}`;
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push(r);
      }
    }

    return {
      pass: deduped.length === 0,
      reasons: deduped,
    };
  }

  function evaluateReviewRow(row) {
    return evaluateReviewBodies({
      body_pros: row.body_pros,
      body_concerns: row.body_concerns,
      body_before: row.body_before || row.body_situation,
      body_results: row.body_results || row.body_learnings,
      body_recommend: row.body_recommend,
      body_other: row.body_other,
    });
  }

  function readUnlockLabel(status) {
    const map = {
      pending: "閲覧解除待ち",
      auto_approved: "自動解除済み",
      admin_approved: "運営が解除済み",
      denied: "閲覧解除不可",
    };
    return map[status] || status;
  }

  window.ReviewQuality = {
    REQUIRED_FIELDS,
    countChars,
    isLowQualityText,
    isGibberishText,
    evaluateReviewBodies,
    evaluateReviewRow,
    readUnlockLabel,
  };
})();
