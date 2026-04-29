/** Minimum scene fields needed to align subtitle cues with the film timeline. */
export type SceneSrtInput = {
  id: string;
  index: number;
  durationSeconds: number;
  title: string;
  voiceoverText: string;
  description: string;
};

/** SRT `HH:MM:SS,mmm` from wall-clock seconds on the film timeline. */
export function formatSrtTimestamp(totalSeconds: number): string {
  const t = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
  const totalMs = Math.round(t * 1000);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(
    ms,
  ).padStart(3, "0")}`;
}

function startSecondsForScene(ordered: SceneSrtInput[], sceneId: string): number {
  let acc = 0;
  for (const sc of ordered) {
    if (sc.id === sceneId) return acc;
    const dur = Number.isFinite(sc.durationSeconds) ? Math.max(0, sc.durationSeconds) : 0;
    acc += dur;
  }
  return 0;
}

/**
 * One subtitle block per scene, timed to scene boundaries (same as {@link buildRenderFilmTimeline} / film).
 * Prefers voiceover, then description, then title.
 */
export function buildSceneVoiceoverSrt(scenes: SceneSrtInput[]): string {
  const ordered = [...scenes].sort((a, b) => a.index - b.index);
  const parts: string[] = [];
  let n = 1;
  for (const sc of ordered) {
    const dur = Number.isFinite(sc.durationSeconds) ? sc.durationSeconds : 0;
    if (dur <= 0) continue;
    const start = startSecondsForScene(ordered, sc.id);
    const end = start + dur;
    const raw = sc.voiceoverText.trim() || sc.description.trim() || sc.title.trim() || "—";
    const text = raw.replace(/\r\n/g, "\n");
    const entry = [String(n), `${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}`, text, ""].join("\n");
    parts.push(entry);
    n += 1;
  }
  return parts.join("\n");
}
