const PRODUCTION_API_URL = "https://codezenith-pip3.onrender.com/api";
const DEVELOPMENT_API_URL = "http://localhost:3000/api";

function extractUrl(value = "") {
  const rawValue = String(value).trim();
  if (!rawValue) return "";

  const markdownUrl = rawValue.match(/\((https?:\/\/[^)]+)\)/i);
  if (markdownUrl) return markdownUrl[1];

  const plainUrl = rawValue.match(/https?:\/\/\S+/i);
  return plainUrl ? plainUrl[0].replace(/[)\]]+$/, "") : rawValue;
}

function ensureApiPath(value) {
  const rawUrl = extractUrl(value).replace(/\/+$/, "");
  if (!rawUrl) return rawUrl;
  if (rawUrl === "/api" || rawUrl.endsWith("/api")) return rawUrl;

  try {
    const url = new URL(rawUrl);
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/api";
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    if (!rawUrl.startsWith("/") || rawUrl === "/") return rawUrl;
  }

  return rawUrl;
}

export const API_BASE_URL = ensureApiPath(
  import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? PRODUCTION_API_URL : DEVELOPMENT_API_URL)
);

export function getApiOrigin() {
  try {
    return new URL(API_BASE_URL, window.location.origin).origin;
  } catch {
    return API_BASE_URL.replace(/\/api\/?$/, "");
  }
}
