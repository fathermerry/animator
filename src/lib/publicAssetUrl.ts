/**
 * Resolves app-root paths (e.g. `/renders/...` from the render API) for `<img src>` so they work with
 * {@link import.meta.env.BASE_URL} (e.g. `base: './'` or a subpath deploy). Leaves `data:`, `blob:`, and
 * absolute `http(s):` URLs unchanged.
 *
 * When Vite `base` is relative (`./`), joining `./` + `renders/...` yields a URL relative to the **current
 * document path**, which breaks for non-root paths (e.g. history routing). For root-absolute `t` we
 * resolve against `window.location.origin` in http(s) pages only.
 */
export function publicAssetUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/^(data:|blob:)/i.test(t)) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/")) {
    const base = import.meta.env.BASE_URL;
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    const path = t.slice(1);
    const relativeDeployBase = normalizedBase.startsWith("./") || normalizedBase.startsWith("../");
    if (
      relativeDeployBase &&
      typeof window !== "undefined" &&
      (window.location.protocol === "http:" || window.location.protocol === "https:")
    ) {
      return new URL(t, window.location.origin).href;
    }
    return `${normalizedBase}${path}`;
  }
  return t;
}
