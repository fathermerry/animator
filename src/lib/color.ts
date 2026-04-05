/** Normalize to #rrggbb for `<input type="color">` */
export function normalizeHex(c: string): string {
  const t = c.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
  if (/^#[0-9A-Fa-f]{3}$/.test(t)) {
    const r = t[1]!;
    const g = t[2]!;
    const b = t[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#000000";
}

function srgbChannelToLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance for a #rrggbb color (via `normalizeHex`). */
export function relativeLuminance(hex: string): number {
  const h = normalizeHex(hex);
  const r = srgbChannelToLinear(parseInt(h.slice(1, 3), 16) / 255);
  const g = srgbChannelToLinear(parseInt(h.slice(3, 5), 16) / 255);
  const b = srgbChannelToLinear(parseInt(h.slice(5, 7), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True when the plate reads as light — use dark kit overlay strokes/text. */
export function isLightBackground(hex: string): boolean {
  return relativeLuminance(hex) > 0.5;
}

/** Tailwind classes for the assets preview kit id badge (flat border + text only). */
export function kitSelectionOverlayClasses(bgHex: string): string {
  return isLightBackground(bgHex)
    ? "border-2 border-black text-black"
    : "border-2 border-white text-white";
}
