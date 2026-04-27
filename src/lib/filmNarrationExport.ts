import type { FilmSegmentInput } from "@/lib/renderFilmTimeline";

export type NarrationExportClip = {
  durationInFrames: number;
  /** Absolute `http(s):` or `data:`; omit layer when null. */
  src: string | null;
};

/**
 * One clip per scene in film order, with duration equal to the sum of that scene’s
 * {@link FilmSegmentInput} run (matches {@link useNarrationFilmSync} scene spans).
 */
export function buildNarrationExportClips(
  segments: FilmSegmentInput[],
  scenes: { id: string; narrationAudioSrc?: string }[],
): NarrationExportClip[] {
  const byId = new Map(
    scenes.map((s) => [s.id, (s.narrationAudioSrc ?? "").trim() || null] as const),
  );
  const groups: { sceneId: string; durationInFrames: number }[] = [];
  for (const seg of segments) {
    const last = groups[groups.length - 1];
    if (last && last.sceneId === seg.sceneId) {
      last.durationInFrames += seg.durationInFrames;
    } else {
      groups.push({ sceneId: seg.sceneId, durationInFrames: seg.durationInFrames });
    }
  }
  return groups.map((g) => ({
    durationInFrames: g.durationInFrames,
    src: byId.get(g.sceneId) ?? null,
  }));
}
