import type { AssetBundle, KitAsset } from "@/types/assetsConfig";

/** Three-character character id: C + two-digit index (1-based), e.g. C01. */
export function formatCharacterKitId(index: number): string {
  return `C${String(index + 1).padStart(2, "0")}`;
}

/** Three-digit object id (1-based), e.g. 001, 010 — uses all three characters as numerals. */
export function formatObjectKitId(index: number): string {
  return String(index + 1).padStart(3, "0");
}

export function renumberCharacterKitIds(list: KitAsset[]): KitAsset[] {
  return list.map((a, i) => ({ ...a, id: formatCharacterKitId(i) }));
}

export function renumberObjectKitIds(list: KitAsset[]): KitAsset[] {
  return list.map((a, i) => ({ ...a, id: formatObjectKitId(i) }));
}

export function renumberKitAssetsWithMaps(bundle: AssetBundle): {
  assets: AssetBundle;
  characterIdMap: Map<string, string>;
  objectIdMap: Map<string, string>;
} {
  const characterIdMap = new Map<string, string>();
  const objectIdMap = new Map<string, string>();

  const characters = bundle.characters.map((a, i) => {
    const newId = formatCharacterKitId(i);
    characterIdMap.set(a.id, newId);
    return { ...a, id: newId };
  });

  const objects = bundle.objects.map((a, i) => {
    const newId = formatObjectKitId(i);
    objectIdMap.set(a.id, newId);
    return { ...a, id: newId };
  });

  return {
    assets: { ...bundle, characters, objects },
    characterIdMap,
    objectIdMap,
  };
}
