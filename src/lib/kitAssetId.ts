import type { Style, StyleAsset } from "@/types/styleConfig";

/** Three-character character id: C + two-digit index (1-based), e.g. C01. */
export function formatCharacterKitId(index: number): string {
  return `C${String(index + 1).padStart(2, "0")}`;
}

/** Three-digit object id (1-based), e.g. 001, 010 — uses all three characters as numerals. */
export function formatObjectKitId(index: number): string {
  return String(index + 1).padStart(3, "0");
}

export function renumberCharacterKitIds(list: StyleAsset[]): StyleAsset[] {
  return list.map((a, i) => ({ ...a, id: formatCharacterKitId(i) }));
}

export function renumberObjectKitIds(list: StyleAsset[]): StyleAsset[] {
  return list.map((a, i) => ({ ...a, id: formatObjectKitId(i) }));
}

export function renumberStyleKitAssetsWithMaps(style: Style): {
  style: Style;
  characterIdMap: Map<string, string>;
  objectIdMap: Map<string, string>;
} {
  const characterIdMap = new Map<string, string>();
  const objectIdMap = new Map<string, string>();

  const characters = style.characters.map((a, i) => {
    const newId = formatCharacterKitId(i);
    characterIdMap.set(a.id, newId);
    return { ...a, id: newId };
  });

  const objects = style.objects.map((a, i) => {
    const newId = formatObjectKitId(i);
    objectIdMap.set(a.id, newId);
    return { ...a, id: newId };
  });

  return {
    style: { ...style, characters, objects },
    characterIdMap,
    objectIdMap,
  };
}
