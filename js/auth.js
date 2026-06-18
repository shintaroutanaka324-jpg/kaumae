(function () {
  let client = null;
  let session = null;
  let profile = null;
  let readyPromise = null;

  function getConfig() {
    return window.SUPABASE_CONFIG || {};
  }

  function isConfigured() {
    const { url, anonKey } = getConfig();
    if (!url || !anonKey) return false;
    if (url.includes("YOUR_SUPABASE")) return false;
    if (anonKey.includes("YOUR_SUPABASE")) return false;
    return true;
  }

  function getSiteBaseUrl() {
    const configPath = getConfig().siteBasePath;
    if (configPath) {
      const normalized = configPath.startsWith("/") ? configPath : `/${configPath}`;
      const withSlash = normalized.endsWith("/") ? normalized : `${normalized}/`;
      return `${window.location.origin}${withSlash}`;
    }
    const path = window.location.pathname;
    const lastSlash = path.lastIndexOf("/");
    const dir = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : "/";
    return `${window.location.origin}${dir}`;
  }

  function getAuthPageUrl(filename) {
    return `${getSiteBaseUrl()}${filename}`;
  }

  function clearLegacyAuthStorage() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
  }

  function loadSupabaseLib() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Supabase SDK の読み込みに失敗しました"));
      document.head.appendChild(script);
    });
  }

  const AGE_GROUPS = ["10代", "20代", "30代", "40代", "50代", "60代以上"];
  const GENDERS = ["男性", "女性", "その他", "回答しない"];

  function isValidAgeGroup(value) {
    return AGE_GROUPS.includes(value);
  }

  function isValidGender(value) {
    return GENDERS.includes(value);
  }

  const PROFILE_COLUMNS_CORE =
    "display_name, email, is_admin, is_paid_member, is_paid, has_posted_review, subscription_status, stripe_subscription_id, stripe_customer_id";
  const PROFILE_COLUMNS_DEMO = "age_group, gender";

  function isMissingProfileColumnError(error, columnNames) {
    const msg = (error?.message || "").toLowerCase();
    if (!msg.includes("column") && !msg.includes("schema cache")) return false;
    return columnNames.some((name) => msg.includes(name.toLowerCase()));
  }

  async function fetchProfile(userId) {
    if (!client || !userId) {
      profile = null;
      return;
    }

    const { data, error } = await client
      .from("profiles")
      .select(PROFILE_COLUMNS_CORE)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[カウマエ] プロフィール取得エラー", error.message);
      profile = null;
      return;
    }

    if (!data) {
      profile = null;
      return;
    }

    profile = data;

    const demoResult = await client
      .from("profiles")
      .select(PROFILE_COLUMNS_DEMO)
      .eq("id", userId)
      .maybeSingle();

    if (demoResult.error) {
      if (!isMissingProfileColumnError(demoResult.error, ["age_group", "gender"])) {
        console.warn("[カウマエ] 年代・性別の取得エラー", demoResult.error.message);
      }
      return;
    }

    if (demoResult.data) {
      profile.age_group = demoResult.data.age_group;
      profile.gender = demoResult.data.gender;
    }
  }

  async function completeAuthFromUrl() {
    if (!client) return { ok: false };

    const pageUrl = new URL(window.location.href);
    const errorDescription = pageUrl.searchParams.get("error_description");
    if (errorDescription) {
      return { ok: false, error: decodeURIComponent(errorDescription.replace(/\+/g, " ")) };
    }

    const code = pageUrl.searchParams.get("code");
    if (code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) return { ok: false, error: mapAuthError(error) };
      session = data.session ?? null;
      if (session?.user) await fetchProfile(session.user.id);
      window.history.replaceState({}, document.title, pageUrl.pathname);
      return { ok: true };
    }

    if (pageUrl.hash.includes("access_token=")) {
      const { data, error } = await client.auth.getSession();
      if (error) return { ok: false, error: mapAuthError(error) };
      session = data.session ?? null;
      if (session?.user) await fetchProfile(session.user.id);
      window.history.replaceState({}, document.title, pageUrl.pathname);
      return { ok: Boolean(session) };
    }

    return { ok: false };
  }

  async function init() {
    clearLegacyAuthStorage();

    if (!isConfigured()) {
      session = null;
      profile = null;
      return;
    }

    await loadSupabaseLib();
    const { url, anonKey } = getConfig();
    client = window.supabase.createClient(url, anonKey, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });

    await completeAuthFromUrl();

    const { data, error } = await client.auth.getSession();
    if (error) {
      console.warn("[カウマエ] セッション取得エラー", error.message);
    }

    session = data?.session ?? null;
    if (session?.user) {
      await fetchProfile(session.user.id);
    }

    client.auth.onAuthStateChange(async (_event, nextSession) => {
      session = nextSession;
      if (nextSession?.user) {
        await fetchProfile(nextSession.user.id);
      } else {
        profile = null;
      }
      window.dispatchEvent(new CustomEvent("auth:changed"));
    });
  }

  function whenReady() {
    if (!readyPromise) {
      readyPromise = init().catch((err) => {
        console.warn("[カウマエ] 認証の初期化に失敗しました", err);
      });
    }
    return readyPromise;
  }

  function ensureClient() {
    if (!isConfigured()) {
      throw new Error("認証が設定されていません。管理者に supabase-config.js の設定を確認してください。");
    }
    if (!client) {
      throw new Error("認証クライアントの準備ができていません。ページを再読み込みしてください。");
    }
    return client;
  }

  const DUPLICATE_EMAIL_MESSAGE = "このメールアドレスは既に登録されています";

  function isDuplicateSignUpResponse(data) {
    const user = data?.user;
    if (!user || data?.session) return false;

    // Supabase 公式: 登録済みメールでは identities が空配列になる
    if (Array.isArray(user.identities) && user.identities.length === 0) {
      return true;
    }

    // メール確認済みアカウントへの再登録
    if (user.email_confirmed_at) {
      return true;
    }

    // 既存ユーザーの created_at が古い（今回の登録操作で作られたものではない）
    if (user.created_at) {
      const createdMs = new Date(user.created_at).getTime();
      if (Number.isFinite(createdMs) && Date.now() - createdMs > 15_000) {
        return true;
      }
    }

    return false;
  }

  function isDuplicateEmailError(error) {
    const message = (error?.message || "").toLowerCase();
    const code = (error?.code || "").toLowerCase();
    return (
      code === "user_already_exists" ||
      code === "email_exists" ||
      code === "email_address_already_exists" ||
      message.includes("already registered") ||
      message.includes("user already registered") ||
      message.includes("already been registered") ||
      message.includes("email address is already") ||
      message.includes("already in use")
    );
  }

  function mapAuthError(error) {
    const message = error?.message || "エラーが発生しました";
    if (isDuplicateEmailError(error)) {
      return DUPLICATE_EMAIL_MESSAGE;
    }
    if (message.includes("Invalid login credentials")) {
      return "メールアドレスまたはパスワードが正しくありません";
    }
    if (message.includes("Email not confirmed")) {
      return "メールアドレスの確認が完了していません。受信トレイをご確認ください";
    }
    if (message.includes("Password should be at least")) {
      return "パスワードは8文字以上で設定してください";
    }
    if (message.includes("Unable to validate email address")) {
      return "メールアドレスの形式が正しくありません";
    }
    if (message.includes("Signup requires a valid password")) {
      return "有効なパスワードを入力してください";
    }
    return message;
  }

  async function isEmailRegistered(email) {
    const normalized = email.trim();
    if (!normalized) return false;

    const supabase = ensureClient();

    const { data: rpcHit, error: rpcError } = await supabase.rpc("is_email_registered", {
      check_email: normalized,
    });
    if (!rpcError && rpcHit === true) return true;

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", normalized)
      .limit(1);

    if (!profileError && profiles?.length > 0) return true;

    return false;
  }

  async function signUp({ email, password, displayName, ageGroup, gender }) {
    const supabase = ensureClient();
    const trimmedEmail = email.trim();

    if (!isValidAgeGroup(ageGroup)) {
      throw new Error("年代を選択してください");
    }
    if (!isValidGender(gender)) {
      throw new Error("性別を選択してください");
    }

    if (await isEmailRegistered(trimmedEmail)) {
      throw new Error(DUPLICATE_EMAIL_MESSAGE);
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { display_name: displayName, age_group: ageGroup, gender },
        emailRedirectTo: getAuthPageUrl("auth-callback.html"),
      },
    });
    if (error) throw new Error(mapAuthError(error));

    if (isDuplicateSignUpResponse(data)) {
      throw new Error(DUPLICATE_EMAIL_MESSAGE);
    }

    session = data.session;
    if (session?.user) {
      await fetchProfile(session.user.id);
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ age_group: ageGroup, gender })
        .eq("id", session.user.id);
      if (profileError) {
        console.warn("[カウマエ] プロフィール年代・性別の保存エラー", profileError.message);
      } else {
        await fetchProfile(session.user.id);
      }
    }
    return data;
  }

  const WITHDRAWN_ACCOUNT_MESSAGE =
    "このアカウントは退会済みです。再度利用する場合は新規登録を行ってください。";

  const MAX_LOGIN_ATTEMPTS = 5;
  const LOGIN_LOCKOUT_HOURS = 24;

  function formatLockoutUntil(lockedUntil) {
    if (!lockedUntil) return "";
    const date = new Date(lockedUntil);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function buildLoginLockoutMessage(status) {
    const untilText = formatLockoutUntil(status?.locked_until);
    if (untilText) {
      return `ログイン試行回数が${MAX_LOGIN_ATTEMPTS}回に達したため、アカウントを一時的にロックしました。${untilText}以降に再度お試しください。`;
    }
    return `ログイン試行回数が${MAX_LOGIN_ATTEMPTS}回に達したため、アカウントを一時的にロックしました。${LOGIN_LOCKOUT_HOURS}時間後に再度お試しください。`;
  }

  function buildLoginFailureMessage(status) {
    if (status?.locked) {
      return buildLoginLockoutMessage(status);
    }
    const remaining = Number(status?.attempts_remaining);
    if (Number.isFinite(remaining) && remaining > 0 && remaining < MAX_LOGIN_ATTEMPTS) {
      return `メールアドレスまたはパスワードが正しくありません。あと${remaining}回でアカウントがロックされます。`;
    }
    return "メールアドレスまたはパスワードが正しくありません";
  }

  async function getLoginLockoutStatus(email) {
    const supabase = ensureClient();
    const { data, error } = await supabase.rpc("get_login_lockout_status", {
      check_email: email.trim(),
    });
    if (error) {
      console.warn("[カウマエ] ログインロック確認エラー", error.message);
      return null;
    }
    return data;
  }

  async function recordLoginFailure(email) {
    const supabase = ensureClient();
    const { data, error } = await supabase.rpc("record_login_failure", {
      check_email: email.trim(),
    });
    if (error) {
      console.warn("[カウマエ] ログイン失敗記録エラー", error.message);
      return null;
    }
    return data;
  }

  async function clearLoginLockout(email) {
    const supabase = ensureClient();
    const { error } = await supabase.rpc("clear_login_lockout", {
      check_email: email.trim(),
    });
    if (error) {
      console.warn("[カウマエ] ログインロック解除エラー", error.message);
    }
  }

  async function notifyLoginFailure(email, failureStatus) {
    const { url, anonKey } = getConfig();
    if (!url || !anonKey) return;

    const endpoint = `${url.replace(/\/$/, "")}/functions/v1/notify-login-failure`;

    try {
      await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          failedAttempts: failureStatus?.failed_attempts ?? null,
          locked: failureStatus?.locked === true,
          lockedUntil: failureStatus?.locked_until ?? null,
        }),
      });
    } catch (err) {
      console.warn("[カウマエ] ログイン失敗通知メール送信エラー", err);
    }
  }

  async function assertLoginNotLocked(email) {
    const status = await getLoginLockoutStatus(email);
    if (status?.locked) {
      throw new Error(buildLoginLockoutMessage(status));
    }
  }

  async function isWithdrawnEmail(email) {
    const normalized = email.trim();
    if (!normalized || !client) return false;

    const { data, error } = await client.rpc("is_withdrawn_email", {
      check_email: normalized,
    });
    if (error) {
      console.warn("[カウマエ] 退会メール確認エラー", error.message);
      return false;
    }
    return data === true;
  }

  async function signIn({ email, password }) {
    const supabase = ensureClient();
    const trimmedEmail = email.trim();

    if (await isWithdrawnEmail(trimmedEmail)) {
      throw new Error(WITHDRAWN_ACCOUNT_MESSAGE);
    }

    await assertLoginNotLocked(trimmedEmail);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      const isInvalidCredentials =
        (error.message || "").includes("Invalid login credentials") ||
        error.code === "invalid_credentials";

      if (isInvalidCredentials) {
        const failureStatus = await recordLoginFailure(trimmedEmail);
        void notifyLoginFailure(trimmedEmail, failureStatus);
        throw new Error(buildLoginFailureMessage(failureStatus));
      }

      throw new Error(mapAuthError(error));
    }

    await clearLoginLockout(trimmedEmail);

    session = data.session;
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
    window.dispatchEvent(new CustomEvent("auth:changed"));
    return data;
  }

  async function signOut() {
    if (client) {
      await client.auth.signOut();
    }
    session = null;
    profile = null;
    clearLegacyAuthStorage();
  }

  async function resetPassword(email) {
    const supabase = ensureClient();
    const redirectTo = getAuthPageUrl("reset-password.html");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(mapAuthError(error));
  }

  async function updatePassword(newPassword) {
    const supabase = ensureClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(mapAuthError(error));
    const email = session?.user?.email;
    if (email) {
      await clearLoginLockout(email);
    }
  }

  function isLoggedIn() {
    return Boolean(session?.user);
  }

  function getUser() {
    return session?.user ?? null;
  }

  function getUserName() {
    return (
      profile?.display_name ||
      session?.user?.user_metadata?.display_name ||
      session?.user?.email?.split("@")[0] ||
      "ユーザー"
    );
  }

  function getUserEmail() {
    return profile?.email || session?.user?.email || "";
  }

  function isAdmin() {
    return profile?.is_admin === true;
  }

  function isPaidMember() {
    return profile?.is_paid === true || profile?.is_paid_member === true;
  }

  function hasPostedReview() {
    return profile?.has_posted_review === true;
  }

  function getSubscriptionStatus() {
    return profile?.subscription_status || null;
  }

  function getAgeGroup() {
    return profile?.age_group || session?.user?.user_metadata?.age_group || "";
  }

  function getGender() {
    return profile?.gender || session?.user?.user_metadata?.gender || "";
  }

  function getProfile() {
    return profile;
  }

  async function refreshProfile() {
    if (session?.user) {
      await fetchProfile(session.user.id);
      window.dispatchEvent(new CustomEvent("auth:changed"));
    }
  }

  async function ensureProfile() {
    if (!session?.user) return null;
    if (!profile) {
      await fetchProfile(session.user.id);
    }
    return profile;
  }

  async function updateProfile({ displayName, ageGroup, gender } = {}) {
    const supabase = ensureClient();
    if (!session?.user) throw new Error("ログインが必要です");

    const profileUpdates = {};
    const metadata = {};

    if (displayName !== undefined) {
      const trimmed = displayName.trim();
      if (!trimmed) throw new Error("ユーザー名を入力してください");
      profileUpdates.display_name = trimmed;
      metadata.display_name = trimmed;
    }

    if (ageGroup !== undefined) {
      if (!isValidAgeGroup(ageGroup)) throw new Error("年代を選択してください");
      profileUpdates.age_group = ageGroup;
      metadata.age_group = ageGroup;
    }

    if (gender !== undefined) {
      if (!isValidGender(gender)) throw new Error("性別を選択してください");
      profileUpdates.gender = gender;
      metadata.gender = gender;
    }

    if (!Object.keys(profileUpdates).length && !Object.keys(metadata).length) {
      return profile;
    }

    if (Object.keys(metadata).length) {
      const { error: metaError } = await supabase.auth.updateUser({ data: metadata });
      if (metaError) throw new Error(mapAuthError(metaError));
    }

    if (Object.keys(profileUpdates).length) {
      let { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", session.user.id);

      if (profileError && isMissingProfileColumnError(profileError, ["age_group", "gender"])) {
        const fallback = { ...profileUpdates };
        delete fallback.age_group;
        delete fallback.gender;
        if (Object.keys(fallback).length) {
          ({ error: profileError } = await supabase
            .from("profiles")
            .update(fallback)
            .eq("id", session.user.id));
        } else {
          profileError = null;
        }
      }

      if (profileError) throw new Error(profileError.message);
    }

    await fetchProfile(session.user.id);
    if (ageGroup !== undefined || gender !== undefined) {
      try {
        await window.ReviewsApi?.syncUserReviewDemographics?.(session.user.id, {
          ageGroup: ageGroup !== undefined ? ageGroup : undefined,
          gender: gender !== undefined ? gender : undefined,
        });
      } catch (err) {
        console.warn("[カウマエ] 口コミへの年代・性別反映エラー", err.message);
      }
    }
    window.dispatchEvent(new CustomEvent("auth:changed"));
    return profile;
  }

  function getClient() {
    return client;
  }

  window.Auth = {
    whenReady,
    isConfigured,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    isLoggedIn,
    isAdmin,
    isPaidMember,
    hasPostedReview,
    getSubscriptionStatus,
    getProfile,
    refreshProfile,
    ensureProfile,
    getClient,
    getUser,
    getUserName,
    getUserEmail,
    getAgeGroup,
    getGender,
    AGE_GROUPS,
    GENDERS,
    mapAuthError,
    isEmailRegistered,
    isDuplicateSignUpResponse,
    completeAuthFromUrl,
    getSiteBaseUrl,
    getAuthPageUrl,
    DUPLICATE_EMAIL_MESSAGE,
    WITHDRAWN_ACCOUNT_MESSAGE,
    isWithdrawnEmail,
    MAX_LOGIN_ATTEMPTS,
    LOGIN_LOCKOUT_HOURS,
    getLoginLockoutStatus,
  };
})();
