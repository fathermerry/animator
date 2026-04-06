/**
 * Detects legacy frame `src` values that pointed at the old bundled placeholder asset.
 * Empty `src` is treated as no output image.
 */
export function isPlaceholderKitSrc(src: string): boolean {
  const t = src?.trim() ?? "";
  if (!t) return true;
  return t.includes("placeholder.png");
}
