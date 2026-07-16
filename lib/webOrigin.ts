const DEFAULT_FYDOR_WEB_ORIGIN = "https://fydor.vercel.app";
const configuredFydorWebOrigin = import.meta.env.VITE_FYDOR_WEB_ORIGIN ?? DEFAULT_FYDOR_WEB_ORIGIN;

export function normalizeFydorWebOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("VITE_FYDOR_WEB_ORIGIN must be an absolute URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Fydor website origin must use HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Fydor website origin cannot contain credentials, a query, or a fragment.");
  }
  if (!/^\/*$/.test(url.pathname)) throw new Error("Fydor website origin cannot contain a path.");
  return url.origin;
}

export function fydorWebUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Fydor website path must be root-relative.");
  return new URL(path, `${normalizeFydorWebOrigin(configuredFydorWebOrigin)}/`).toString();
}
