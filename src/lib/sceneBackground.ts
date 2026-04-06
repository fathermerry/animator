import type { Scene } from "@/types/project";
import type { AssetBundle, Background } from "@/types/styleConfig";

/** Resolved plate for a scene: scene overrides fall back to the style kit defaults. */
export function resolveSceneBackground(scene: Scene | null | undefined, bundle: AssetBundle): Background {
  if (!scene) {
    return bundle.background;
  }
  const color = scene.backgroundColor?.trim() || bundle.background.color;
  const src =
    scene.backgroundImageSrc?.trim() || bundle.background.src?.trim() || undefined;
  return {
    color,
    ...(src ? { src } : {}),
  };
}
