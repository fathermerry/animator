import { publicAssetUrl } from "@/lib/publicAssetUrl";

/**
 * Resolves kit `src` for `<img>`: `data:` / `blob:` / `http(s):` as-is; root paths via {@link publicAssetUrl}.
 * Pure (no hook) so the first paint always has the final URL — avoids empty `src` or effect ordering bugs.
 */
export function kitAssetDisplaySrc(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^(data:|blob:)/i.test(t)) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return publicAssetUrl(t);
}
