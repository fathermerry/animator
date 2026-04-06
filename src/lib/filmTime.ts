import type { Scene } from "@/types/project";

/** Whole seconds as `m:ss` (e.g. `0:45`, `12:30`). */
export function formatDurationMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const DURATION_INPUT_MAX_SEC = 24 * 60 * 60;

/**
 * Parse scene length from `m:ss` (seconds 0–59) or a plain seconds integer.
 * Returns `null` if the string cannot be interpreted.
 */
export function parseDurationMmSsInput(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return 0;
  const parts = t.split(":");
  if (parts.length === 2) {
    const mStr = parts[0]!.trim();
    const sStr = parts[1]!.trim();
    if (!/^\d+$/.test(mStr) || !/^\d+$/.test(sStr)) return null;
    const m = parseInt(mStr, 10);
    let sec = parseInt(sStr, 10);
    if (sec > 59) sec = 59;
    const total = m * 60 + sec;
    return Math.min(Math.max(0, total), DURATION_INPUT_MAX_SEC);
  }
  if (parts.length === 1 && /^\d+$/.test(t)) {
    const n = parseInt(t, 10);
    return Math.min(Math.max(0, n), DURATION_INPUT_MAX_SEC);
  }
  return null;
}

/** Format seconds as fixed two-decimal film time (e.g. `0.00`, `12.50`). */
export function formatFilmTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0.00";
  return Math.max(0, seconds).toFixed(2);
}

/**
 * Clock for one film segment: `m:ss.cc` with fractional seconds.
 * Use this when showing **start** and **duration** together; {@link formatDurationMmSs} floors each
 * value and makes “start + duration” disagree with the next row’s start when splits are sub-second.
 */
export function formatFilmSegmentClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return "0:00.00";
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const secPart = s - m * 60;
  return `${m}:${secPart.toFixed(2).padStart(5, "0")}`;
}

/** Seconds from film start to this scene (scenes ordered by `index`). */
export function sceneStartSeconds(scenes: Scene[], sceneId: string): number {
  const ordered = [...scenes].sort((a, b) => a.index - b.index);
  let t = 0;
  for (const s of ordered) {
    if (s.id === sceneId) return t;
    t += Number.isFinite(s.durationSeconds) ? s.durationSeconds : 0;
  }
  return 0;
}

/** Total film length as sum of scene durations. */
export function filmDurationSeconds(scenes: Scene[]): number {
  return scenes.reduce((acc, s) => acc + (Number.isFinite(s.durationSeconds) ? s.durationSeconds : 0), 0);
}

/**
 * Map cumulative story time (sum of prior scene lengths, same order as film) to the active scene
 * and narration clip for combined audio preview.
 */
export function getStoryNarrationPlaybackAtGlobalSeconds(
  globalSec: number,
  scenes: Scene[],
): {
  sceneId: string;
  elapsedInSceneSeconds: number;
  sceneDurationSeconds: number;
  narrationSrc: string | null;
} | null {
  const ordered = [...scenes].sort((a, b) => a.index - b.index);
  if (ordered.length === 0) return null;
  const total = filmDurationSeconds(scenes);
  if (total <= 0) return null;
  const g = Math.max(0, Math.min(globalSec, total));
  let start = 0;
  for (const scene of ordered) {
    const dur = Number.isFinite(scene.durationSeconds) ? Math.max(0, scene.durationSeconds) : 0;
    const end = start + dur;
    if (g >= start && g < end) {
      const src = scene.narrationAudioSrc?.trim() || null;
      return {
        sceneId: scene.id,
        elapsedInSceneSeconds: g - start,
        sceneDurationSeconds: dur,
        narrationSrc: src,
      };
    }
    start = end;
  }
  const last = ordered[ordered.length - 1]!;
  const dur = Number.isFinite(last.durationSeconds) ? Math.max(0, last.durationSeconds) : 0;
  return {
    sceneId: last.id,
    elapsedInSceneSeconds: dur,
    sceneDurationSeconds: dur,
    narrationSrc: last.narrationAudioSrc?.trim() || null,
  };
}
