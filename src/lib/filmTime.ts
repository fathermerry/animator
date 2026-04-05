import type { Scene } from "@/types/project";

/** Whole seconds as `m:ss` (e.g. `0:45`, `12:30`). */
export function formatDurationMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Format seconds as fixed two-decimal film time (e.g. `0.00`, `12.50`). */
export function formatFilmTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0.00";
  return Math.max(0, seconds).toFixed(2);
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
