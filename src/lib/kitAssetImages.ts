import type { KitAsset } from "@/types/styleConfig";

/** Max reference images stored per character kit asset. */
export const KIT_ASSET_MAX_IMAGES = 5;

/**
 * Ordered list of image URLs for a character (deduped, capped).
 * Uses `imageSrcs` when present; otherwise falls back to `src`.
 */
export function normalizeCharacterKitImageSrcs(asset: KitAsset): string[] {
  const rawArr = Array.isArray(asset.imageSrcs)
    ? asset.imageSrcs
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];
  const fromSrc = asset.src?.trim() ? [asset.src.trim()] : [];
  const merged = rawArr.length > 0 ? rawArr : fromSrc;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of merged) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= KIT_ASSET_MAX_IMAGES) break;
  }
  return out;
}
