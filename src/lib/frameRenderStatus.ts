import type { Frame, Render } from "@/types/project";

export function findRender(renders: Render[], frame: Frame): Render | undefined {
  return renders.find((r) => r.id === frame.renderId);
}

export function isPlaceholderFrameSrc(src: string): boolean {
  return src.includes("placeholder.png");
}

/** True when the frame should show composite content in the film preview (vs blank plate). */
export function isFrameGeneratedForPreview(frame: Frame, renders: Render[]): boolean {
  const r = findRender(renders, frame);
  if (!r || r.status !== "complete") return false;
  if (isPlaceholderFrameSrc(frame.src)) return false;
  return true;
}
