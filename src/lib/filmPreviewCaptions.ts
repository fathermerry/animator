/**
 * Split voiceover into short cues for preview captions. Paragraphs first, then sentences.
 */
export function splitVoiceoverIntoCaptionCues(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const blocks = t.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const cues: string[] = [];
  for (const block of blocks) {
    const sentences = block.split(/(?<=[.!?？！])\s+/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length > 0) cues.push(...sentences);
    else cues.push(block);
  }
  return cues.length > 0 ? cues : [t];
}

/** Map 0–1 playback through the scene to one cue (weighted by cue length, approximates speech pacing). */
export function captionCueAtProgress(cues: string[], ratio: number): string {
  if (cues.length === 0) return "";
  const r = Math.min(1, Math.max(0, ratio));
  if (cues.length === 1) return cues[0]!;
  const weights = cues.map((c) => Math.max(1, [...c].length));
  const total = weights.reduce((a, b) => a + b, 0);
  let target = r * total;
  for (let i = 0; i < cues.length; i++) {
    const w = weights[i]!;
    target -= w;
    if (target < 0) return cues[i]!;
  }
  return cues[cues.length - 1]!;
}

export function captionCueForVoiceoverSync(voiceover: string, sceneProgressRatio: number): string {
  const cues = splitVoiceoverIntoCaptionCues(voiceover);
  return captionCueAtProgress(cues, sceneProgressRatio);
}
