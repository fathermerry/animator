import { isFrameGeneratedForPreview } from "@/lib/frameRenderStatus";
import { framesForSceneSorted } from "@/lib/sceneFrames";
import type { Frame, Render, Scene } from "@/types/project";
import type { AssetBundle, KitAsset } from "@/types/styleConfig";

export const FILM_FPS = 30;

export type FilmSegmentInput = {
  durationInFrames: number;
  blank: boolean;
  /** Scene this segment belongs to (for editing UI / playback context). */
  sceneId: string;
  /** Project frame id for this segment, or null for scene padding with no frames. */
  frameId: string | null;
  /** Generated still URL (`frame.src`) when render is complete; drives film preview image layer. */
  stillSrc?: string | null;
  assetBundle: AssetBundle;
  sceneTitle: string;
  /** Frame staging copy, or scene beat when there is no frame row. */
  frameDescription: string;
  characters: KitAsset[];
};

function resolveKitAssets(ids: string[], pool: KitAsset[]): KitAsset[] {
  const out: KitAsset[] = [];
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
  assetBundle: AssetBundle,
): { segments: FilmSegmentInput[]; totalFrames: number } {
  const ordered = [...scenes].sort((a, b) => a.index - b.index);
  const segments: FilmSegmentInput[] = [];

  for (const scene of ordered) {
    const sceneFrames = framesForSceneSorted(frames, scene.id);
    const durSec = Number.isFinite(scene.durationSeconds) ? Math.max(0, scene.durationSeconds) : 0;
    const chars = resolveKitAssets(scene.characterIds, assetBundle.characters);

    const title = scene.title.trim();
    const sceneBeat = scene.description.trim();

    if (sceneFrames.length === 0) {
      const total = Math.max(1, Math.round(durSec * FILM_FPS));
      segments.push({
        durationInFrames: total,
        blank: true,
        sceneId: scene.id,
        frameId: null,
        assetBundle,
        sceneTitle: title,
        frameDescription: sceneBeat,
        characters: chars,
      });
      continue;
    }

    const frameDurations = splitSceneDurationToFrames(durSec, sceneFrames.length, FILM_FPS);

    sceneFrames.forEach((fr, i) => {
      const durationInFrames = frameDurations[i] ?? 1;
      const generated = isFrameGeneratedForPreview(fr, renders);
      const frameText = (fr.description ?? "").trim();
      const stillSrc = generated ? fr.src.trim() : null;
      segments.push({
        durationInFrames,
        blank: !generated,
        sceneId: scene.id,
        frameId: fr.id,
        stillSrc,
        assetBundle,
        sceneTitle: title,
        frameDescription: frameText || sceneBeat,
        characters: chars,
      });
    });
  }

  const totalFrames = segments.reduce((acc, s) => acc + s.durationInFrames, 0);
  return { segments, totalFrames };
}

/** Start and length in seconds for each project frame row, derived only from {@link buildRenderFilmTimeline} segments (duration per row; start = sum of previous segment lengths). */
export type FilmFrameTiming = {
  startSeconds: number;
  durationSeconds: number;
};

export function getFilmTimingByProjectFrameId(
  scenes: Scene[],
  frames: Frame[],
  renders: Render[],
  assetBundle: AssetBundle,
): Map<string, FilmFrameTiming> {
  const { segments } = buildRenderFilmTimeline(scenes, frames, renders, assetBundle);
  const m = new Map<string, FilmFrameTiming>();
  let accFrames = 0;
  for (const seg of segments) {
    if (seg.frameId != null) {
      m.set(seg.frameId, {
        startSeconds: accFrames / FILM_FPS,
        durationSeconds: seg.durationInFrames / FILM_FPS,
      });
    }
    accFrames += seg.durationInFrames;
  }
  return m;
}

/** Which project frame (by id) is shown at this global film frame index (matches {@link buildRenderFilmTimeline}). */
export function getFrameIdAtFilmGlobalFrame(
  globalFrame: number,
  scenes: Scene[],
  frames: Frame[],
  renders: Render[],
  assetBundle: AssetBundle,
): string | null {
  const { segments, totalFrames } = buildRenderFilmTimeline(scenes, frames, renders, assetBundle);
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

/** Scene and project frame at the playhead (matches {@link buildRenderFilmTimeline}). */
export function getPlaybackContextAtFilmGlobalFrame(
  globalFrame: number,
  scenes: Scene[],
  frames: Frame[],
  renders: Render[],
  assetBundle: AssetBundle,
): { sceneId: string | null; frameId: string | null } {
  const { segments, totalFrames } = buildRenderFilmTimeline(scenes, frames, renders, assetBundle);
  if (segments.length === 0 || totalFrames <= 0) {
    return { sceneId: null, frameId: null };
  }
  const f = Math.max(0, Math.min(Math.floor(globalFrame), totalFrames - 1));
  let t = 0;
  for (const seg of segments) {
    const end = t + seg.durationInFrames;
    if (f >= t && f < end) {
      return { sceneId: seg.sceneId, frameId: seg.frameId };
    }
    t = end;
  }
  const last = segments[segments.length - 1]!;
  return { sceneId: last.sceneId, frameId: last.frameId };
}

/** Global Remotion frame index at the start of a project frame’s segment (matches {@link buildRenderFilmTimeline}). */
export function getFilmStartFrameIndexForFrame(
  targetFrameId: string,
  scenes: Scene[],
  frames: Frame[],
  renders: Render[],
  assetBundle: AssetBundle,
): number | null {
  const { segments } = buildRenderFilmTimeline(scenes, frames, renders, assetBundle);
  let acc = 0;
  for (const seg of segments) {
    if (seg.frameId === targetFrameId) return acc;
    acc += seg.durationInFrames;
  }
  return null;
}
