import { isFrameGeneratedForPreview } from "@/lib/frameRenderStatus";
import { framesForSceneSorted } from "@/lib/sceneFrames";
import type { Frame, Render, Scene } from "@/types/project";
import type { Style, StyleAsset } from "@/types/styleConfig";

export const FILM_FPS = 30;

export type FilmSegmentInput = {
  durationInFrames: number;
  blank: boolean;
  /** Project frame id for this segment, or null for scene padding with no frames. */
  frameId: string | null;
  style: Style;
  sceneTitle: string;
  /** Frame staging copy, or scene beat when there is no frame row. */
  frameDescription: string;
  characters: StyleAsset[];
  objects: StyleAsset[];
};

function resolveStyleAssets(ids: string[], pool: StyleAsset[]): StyleAsset[] {
  const out: StyleAsset[] = [];
  for (const id of ids) {
    const a = pool.find((x) => x.id === id);
    if (a) out.push(a);
  }
  return out;
}

/** Split scene length into per-frame durations (whole frames, sum = round(sceneSeconds * fps)). */
function splitSceneDurationToFrames(sceneSeconds: number, frameCount: number, fps: number): number[] {
  if (frameCount <= 0) return [];
  const total = Math.round(sceneSeconds * fps);
  if (total <= 0) {
    return Array.from({ length: frameCount }, () => 1);
  }
  const base = Math.floor(total / frameCount);
  const remainder = total - base * frameCount;
  return Array.from({ length: frameCount }, (_, i) => Math.max(1, base + (i < remainder ? 1 : 0)));
}

export function buildRenderFilmTimeline(
  scenes: Scene[],
  frames: Frame[],
  renders: Render[],
  style: Style,
): { segments: FilmSegmentInput[]; totalFrames: number } {
  const ordered = [...scenes].sort((a, b) => a.index - b.index);
  const segments: FilmSegmentInput[] = [];

  for (const scene of ordered) {
    const sceneFrames = framesForSceneSorted(frames, scene.id);
    const durSec = Number.isFinite(scene.durationSeconds) ? Math.max(0, scene.durationSeconds) : 0;
    const chars = resolveStyleAssets(scene.characterIds, style.characters);
    const objs = resolveStyleAssets(scene.objectIds, style.objects);

    const title = scene.title.trim();
    const sceneBeat = scene.description.trim();

    if (sceneFrames.length === 0) {
      const total = Math.max(1, Math.round(durSec * FILM_FPS));
      segments.push({
        durationInFrames: total,
        blank: true,
        frameId: null,
        style,
        sceneTitle: title,
        frameDescription: sceneBeat,
        characters: chars,
        objects: objs,
      });
      continue;
    }

    const frameDurations = splitSceneDurationToFrames(durSec, sceneFrames.length, FILM_FPS);

    sceneFrames.forEach((fr, i) => {
      const durationInFrames = frameDurations[i] ?? 1;
      const generated = isFrameGeneratedForPreview(fr, renders);
      const frameText = (fr.description ?? "").trim();
      segments.push({
        durationInFrames,
        blank: !generated,
        frameId: fr.id,
        style,
        sceneTitle: title,
        frameDescription: frameText || sceneBeat,
        characters: chars,
        objects: objs,
      });
    });
  }

  const totalFrames = segments.reduce((acc, s) => acc + s.durationInFrames, 0);
  return { segments, totalFrames };
}

/** Which project frame (by id) is shown at this global film frame index (matches {@link buildRenderFilmTimeline}). */
export function getFrameIdAtFilmGlobalFrame(
  globalFrame: number,
  scenes: Scene[],
  frames: Frame[],
  renders: Render[],
  style: Style,
): string | null {
  const { segments, totalFrames } = buildRenderFilmTimeline(scenes, frames, renders, style);
  if (segments.length === 0 || totalFrames <= 0) return null;
  const f = Math.max(0, Math.min(Math.floor(globalFrame), totalFrames - 1));
  let t = 0;
  for (const seg of segments) {
    const end = t + seg.durationInFrames;
    if (f >= t && f < end) return seg.frameId;
    t = end;
  }
  return segments[segments.length - 1]!.frameId;
}

/** Global Remotion frame index at the start of a project frame’s segment (matches {@link buildRenderFilmTimeline}). */
export function getFilmStartFrameIndexForFrame(
  targetFrameId: string,
  scenes: Scene[],
  frames: Frame[],
  _renders: Render[],
  _style: Style,
): number | null {
  const ordered = [...scenes].sort((a, b) => a.index - b.index);
  let acc = 0;

  for (const scene of ordered) {
    const sceneFrames = framesForSceneSorted(frames, scene.id);
    const durSec = Number.isFinite(scene.durationSeconds) ? Math.max(0, scene.durationSeconds) : 0;

    if (sceneFrames.length === 0) {
      const total = Math.max(1, Math.round(durSec * FILM_FPS));
      acc += total;
      continue;
    }

    const frameDurations = splitSceneDurationToFrames(durSec, sceneFrames.length, FILM_FPS);

    for (let i = 0; i < sceneFrames.length; i++) {
      const fr = sceneFrames[i]!;
      const durationInFrames = frameDurations[i] ?? 1;
      if (fr.id === targetFrameId) return acc;
      acc += durationInFrames;
    }
  }

  return null;
}
