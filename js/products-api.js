(function () {
  const DEFAULT_IMAGE =
    "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&h=300&fit=crop";

  let readyPromise = null;

  function getClient() {
    return window.Auth?.getClient?.() ?? null;
  }

  function ensureConfigured() {
    if (!window.Auth?.isConfigured?.()) {
      throw new Error("Supabase の設定が完了していません。");
    }
    const client = getClient();
    if (!client) throw new Error("接続の準備ができていません。");
    return client;
  }

  function normalizeExternalUrl(raw) {
    const value = String(raw || "").trim();
    if (!value || value === "#") return "";

    let url = value;
    if (/^\/\//.test(url)) {
      url = `https:${url}`;
    } else if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      url = `https://${url}`;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  function resolveProductImageUrl(row) {
    const custom = String(row?.image_url || "").trim();
    if (custom) return custom;
    if (typeof getCategoryImageUrl === "function") {
      const categoryImage = getCategoryImageUrl(row?.category);
      if (categoryImage) return categoryImage;
    }
    return DEFAULT_IMAGE;
  }

  function rowToProduct(row) {
    return {
      id: row.id,
      title: row.title,
      instructor: row.instructor,
      category: row.category,
      price: Number(row.price) || 0,
      platform: row.platform || "オンライン",
      imageUrl: resolveProductImageUrl(row),
      description: row.description || "",
      averageRating: Number(row.average_rating) || 0,
      reviewCount: Number(row.review_count) || 0,
      companyName: row.company_name || "",
      location: row.location || "",
      highlightPro: row.highlight_pro || "",
      highlightCon: row.highlight_con || "",
      proofRate: Number(row.proof_rate) || 0,
      officialUrl: normalizeExternalUrl(row.official_url),
      supportPeriod: row.support_period || "3〜6ヶ月",
      refundPolicy: row.refund_policy || "なし",
      isDbProduct: true,
      isPublished: row.is_published !== false,
      created_at: row.created_at || null,
    };
  }

  function productToRow(product) {
    return {
      id: product.id,
      title: product.title.trim(),
      instructor: product.instructor.trim(),
      category: product.category,
      price: Number(product.price) || 0,
      platform: product.platform?.trim() || null,
      image_url: product.imageUrl?.trim() || null,
      description: product.description?.trim() || null,
      average_rating: Number(product.averageRating) || 0,
      review_count: Number(product.reviewCount) || 0,
      company_name: product.companyName?.trim() || null,
      location: product.location?.trim() || null,
      highlight_pro: product.highlightPro?.trim() || null,
      highlight_con: product.highlightCon?.trim() || null,
      proof_rate: Number(product.proofRate) || 0,
      official_url: normalizeExternalUrl(product.officialUrl) || null,
      support_period: product.supportPeriod?.trim() || null,
      refund_policy: product.refundPolicy?.trim() || null,
      is_published: product.isPublished !== false,
      updated_at: new Date().toISOString(),
    };
  }

  function generateProductId() {
    return `p-${Date.now().toString(36)}`;
  }

  async function uploadProductImage(file, productId) {
    ensureConfigured();
    if (!window.Auth.isAdmin?.()) {
      throw new Error("管理者権限が必要です。");
    }
    if (!file) throw new Error("画像ファイルが選択されていません。");

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const allowed = ["jpg", "jpeg", "png", "webp", "gif"];
    if (!allowed.includes(ext)) {
      throw new Error("JPEG / PNG / WebP / GIF のみアップロードできます。");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("画像は5MB以下にしてください。");
    }

    const path = `${productId}/cover.${ext === "jpeg" ? "jpg" : ext}`;
    const client = getClient();
    const { error } = await client.storage.from("product-images").upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("product-images") || msg.includes("Bucket not found")) {
        throw new Error(
          "画像ストレージが未設定です。Supabase SQL Editor で supabase/schema-products-images.sql を実行してください。"
        );
      }
      throw new Error(`画像のアップロードに失敗しました: ${msg}`);
    }

    const { data } = client.storage.from("product-images").getPublicUrl(path);
    return data?.publicUrl || null;
  }

  function applyProductRegistry(rows) {
    if (typeof setDbProductRegistry !== "function") return;
    setDbProductRegistry(
      (rows || []).map((row) => ({
        id: row.id,
        isPublished: row.is_published !== false,
      }))
    );
  }

  async function loadPublishedProducts() {
    if (!window.Auth?.isConfigured?.()) {
      if (typeof setDbProducts === "function") setDbProducts([]);
      if (typeof setDbProductRegistry === "function") setDbProductRegistry([]);
      return [];
    }
    const client = getClient();
    if (!client) return [];

    const [publishedResult, registryResult] = await Promise.all([
      client
        .from("products")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false }),
      client.from("products").select("id, is_published"),
    ]);

    if (publishedResult.error) {
      console.warn("[カウマエ] サービス一覧の取得に失敗", publishedResult.error.message);
      if (typeof setDbProducts === "function") setDbProducts([]);
      if (typeof setDbProductRegistry === "function") setDbProductRegistry([]);
      return [];
    }

    const products = (publishedResult.data || []).map(rowToProduct);
    if (typeof setDbProducts === "function") setDbProducts(products);

    if (!registryResult.error && registryResult.data) {
      applyProductRegistry(registryResult.data);
    } else {
      if (registryResult.error) {
        console.warn(
          "[カウマエ] サービス登録一覧の取得に失敗（非公開のデモが残る場合は schema-products-public-registry.sql を実行）",
          registryResult.error.message
        );
      }
      applyProductRegistry(publishedResult.data || []);
    }

    return products;
  }

  async function loadAllProductsAdmin() {
    ensureConfigured();
    if (!window.Auth?.isAdmin?.()) {
      throw new Error("管理者権限が必要です。");
    }
    const client = getClient();
    const { data, error } = await client
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    const products = (data || []).map(rowToProduct);
    if (typeof setDbProductsAdmin === "function") setDbProductsAdmin(products);
    return products;
  }

  async function refreshProductCaches() {
    await loadPublishedProducts();
    if (window.Auth?.isAdmin?.()) {
      try {
        await loadAllProductsAdmin();
      } catch (_) {
        /* 非運営コンテキストでは admin 一覧は不要 */
      }
    }
  }

  async function createProduct(input) {
    ensureConfigured();
    if (!window.Auth?.isAdmin?.()) {
      throw new Error("管理者権限が必要です。");
    }
    const client = getClient();
    const product = {
      id: input.id?.trim() || generateProductId(),
      title: input.title,
      instructor: input.instructor,
      category: input.category,
      price: input.price,
      platform: input.platform,
      imageUrl: input.imageUrl,
      description: input.description,
      highlightPro: input.highlightPro,
      highlightCon: input.highlightCon,
      officialUrl: input.officialUrl,
      supportPeriod: input.supportPeriod,
      refundPolicy: input.refundPolicy,
      isPublished: input.isPublished !== false,
    };

    const { data, error } = await client
      .from("products")
      .insert(productToRow(product))
      .select()
      .single();

    if (error) throw new Error(error.message);
    await refreshProductCaches();
    return rowToProduct(data);
  }

  async function updateProduct(id, input) {
    ensureConfigured();
    if (!window.Auth?.isAdmin?.()) {
      throw new Error("管理者権限が必要です。");
    }
    const client = getClient();
    const { data: existing, error: fetchErr } = await client
      .from("products")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const merged = { ...rowToProduct(existing), ...input, id };
    const row = productToRow(merged);
    delete row.id;

    const { data, error } = await client
      .from("products")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    await refreshProductCaches();
    return rowToProduct(data);
  }

  async function setProductPublished(id, isPublished) {
    ensureConfigured();
    if (!window.Auth?.isAdmin?.()) {
      throw new Error("管理者権限が必要です。");
    }
    const client = getClient();
    const { data, error } = await client
      .from("products")
      .update({ is_published: isPublished, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await refreshProductCaches();
    return rowToProduct(data);
  }

  async function deleteProduct(id) {
    ensureConfigured();
    if (!window.Auth?.isAdmin?.()) {
      throw new Error("管理者権限が必要です。");
    }
    const client = getClient();
    const { error } = await client.from("products").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await refreshProductCaches();
  }

  function whenReady() {
    if (!readyPromise) {
      readyPromise = (async () => {
        if (window.Auth?.whenReady) await window.Auth.whenReady();
        await loadPublishedProducts();
      })();
    }
    return readyPromise;
  }

  window.ProductsApi = {
    whenReady,
    loadPublishedProducts,
    loadAllProductsAdmin,
    createProduct,
    updateProduct,
    setProductPublished,
    deleteProduct,
    uploadProductImage,
    generateProductId,
    DEFAULT_IMAGE,
    normalizeExternalUrl,
  };
})();
