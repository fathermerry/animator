import type { AssetBundle, KitAsset } from "@/types/styleConfig";

/** Three-character character id: C + two-digit index (1-based), e.g. C01. */
export function formatCharacterKitId(index: number): string {
  return `C${String(index + 1).padStart(2, "0")}`;
}

export function renumberCharacterKitIds(list: KitAsset[]): KitAsset[] {
  return list.map((a, i) => ({ ...a, id: formatCharacterKitId(i) }));
}

export function renumberKitAssetsWithMaps(bundle: AssetBundle): {
  assets: AssetBundle;
  characterIdMap: Map<string, string>;
} {
  const characterIdMap = new Map<string, string>();

  const characters = bundle.characters.map((a, i) => {
    const newId = formatCharacterKitId(i);
    characterIdMap.set(a.id, newId);
    return { ...a, id: newId };
  });

  return {
    assets: { ...bundle, characters },
    characterIdMap,
  };
}
