import type { FilmSegmentInput } from "@/lib/renderFilmTimeline";
import type { AssetBundle, Background, KitAsset } from "@/types/styleConfig";

function absolutizeUrl(url: string, assetBase: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/^(data:|blob:)/i.test(t)) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/")) {
    const base = assetBase.replace(/\/$/, "");
    return `${base}${t}`;
  }
  return t;
}

function absolutizeBackground(bg: Background, assetBase: string): Background {
  return {
    ...bg,
    ...(bg.src ? { src: absolutizeUrl(bg.src, assetBase) } : {}),
  };
}

function absolutizeKitAsset(a: KitAsset, assetBase: string): KitAsset {
  return {
    ...a,
    ...(a.src ? { src: absolutizeUrl(a.src, assetBase) } : {}),
  };
}

function absolutizeAssetBundle(b: AssetBundle, assetBase: string): AssetBundle {
  return {
    ...b,
    background: absolutizeBackground(b.background, assetBase),
    characters: b.characters.map((c) => absolutizeKitAsset(c, assetBase)),
  };
}

export function absolutizeNarrationSceneMeta(
  scenes: { id: string; narrationAudioSrc?: string }[],
  assetBaseUrl: string,
): { id: string; narrationAudioSrc?: string }[] {
  const base = assetBaseUrl.trim();
  if (!base) return scenes;
  return scenes.map((s) => ({
    ...s,
    ...(s.narrationAudioSrc
      ? { narrationAudioSrc: absolutizeUrl(s.narrationAudioSrc, base) }
      : {}),
  }));
}

/**
 * Remotion (headless Chromium) must load stills and plates with absolute `http(s):` URLs.
 * Preserves `data:` and `blob:` URLs and anything already absolute.
 */
export function absolutizeFilmExportSegments(
  segments: FilmSegmentInput[],
  assetBaseUrl: string,
): FilmSegmentInput[] {
  const base = assetBaseUrl.trim();
  if (!base) return segments;
  return segments.map((seg) => {
    const stillSrc = seg.stillSrc?.trim() ? absolutizeUrl(seg.stillSrc.trim(), base) : seg.stillSrc;
    return {
      ...seg,
      stillSrc,
      plate: absolutizeBackground(seg.plate, base),
      assetBundle: absolutizeAssetBundle(seg.assetBundle, base),
    };
  });
}
