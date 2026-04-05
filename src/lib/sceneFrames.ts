import type { Frame } from "@/types/project";

/** Frames for one scene, sorted by `index` ascending. */
export function framesForSceneSorted(frames: Frame[], sceneId: string): Frame[] {
  return frames
    .filter((f) => f.sceneId === sceneId)
    .slice()
    .sort((a, b) => a.index - b.index);
}
