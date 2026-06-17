const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.kaumae-info.com",
  "https://kaumae-info.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function getAllowedOrigins(): string[] {
  const extra = Deno.env.get("ALLOWED_SITE_ORIGINS");
  if (!extra) return DEFAULT_ALLOWED_ORIGINS;
  return [
    ...DEFAULT_ALLOWED_ORIGINS,
    ...extra.split(",").map((item) => item.trim()).filter(Boolean),
  ];
}

export function sanitizeSiteRedirectUrl(input: unknown, fallback: string): string {
  const allowed = getAllowedOrigins();

  try {
    const url = new URL(String(input || "").trim(), fallback);
    if (!["http:", "https:"].includes(url.protocol)) return fallback;
    if (!allowed.some((origin) => url.origin === origin)) return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}

export function normalizeSiteBase(siteUrl: unknown, fallback = "https://www.kaumae-info.com/"): string {
  const safe = sanitizeSiteRedirectUrl(siteUrl, fallback);
  return safe.endsWith("/") ? safe : `${safe}/`;
}
