import { AbsoluteFill, Audio, Series } from "remotion";

import type { NarrationExportClip } from "@/lib/filmNarrationExport";
import type { FilmSegmentInput } from "@/lib/renderFilmTimeline";
import { FilmComposition } from "@/remotion/FilmComposition";

export type FilmForExportProps = {
  segments: FilmSegmentInput[];
  narrationClips: NarrationExportClip[];
};

/**
 * Full-film Remotion tree for server export: keyframe video plus per-scene narration
 * (aligned to the same timeline as {@link buildRenderFilmTimeline} / the compose preview).
 */
export function FilmForExportComposition({ segments, narrationClips }: FilmForExportProps) {
  return (
    <AbsoluteFill>
      <FilmComposition segments={segments} />
      <AbsoluteFill>
        <Series>
          {narrationClips.map((clip, i) => (
            <Series.Sequence key={i} durationInFrames={clip.durationInFrames}>
              {clip.src ? <Audio src={clip.src} /> : null}
            </Series.Sequence>
          ))}
        </Series>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
