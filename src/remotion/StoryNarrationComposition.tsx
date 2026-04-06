import { AbsoluteFill, Audio, Series } from "remotion";

export type StoryNarrationSegmentInput = {
  sceneId: string;
  durationInFrames: number;
  /** Absolute URL (same-origin) for Remotion */
  src: string | null;
  /** Media duration / scene duration — maps full clip into the scene span */
  playbackRate: number;
};

type Props = {
  segments: StoryNarrationSegmentInput[];
};

export function StoryNarrationComposition({ segments }: Props) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <Series>
        {segments.map((seg) => (
          <Series.Sequence key={seg.sceneId} durationInFrames={seg.durationInFrames}>
            {seg.src ? <Audio src={seg.src} playbackRate={seg.playbackRate} /> : null}
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
