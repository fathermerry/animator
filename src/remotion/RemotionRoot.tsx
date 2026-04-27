import type { FC } from "react";
import { Composition, registerRoot } from "remotion";

import { FILM_FPS } from "@/lib/renderFilmTimeline";
import { FilmForExportComposition } from "@/remotion/FilmForExportComposition";
import type { FilmForExportProps } from "@/remotion/FilmForExportComposition";

const Main: FC = () => {
  return (
    <>
      <Composition
        id="Film"
        component={FilmForExportComposition}
        defaultProps={{ segments: [], narrationClips: [] } satisfies FilmForExportProps}
        width={1920}
        height={1080}
        fps={FILM_FPS}
        calculateMetadata={({ props }) => {
          const segs = (props as FilmForExportProps).segments ?? [];
          const total = segs.reduce((acc, s) => acc + s.durationInFrames, 0);
          return { durationInFrames: Math.max(1, total) };
        }}
      />
    </>
  );
};

registerRoot(Main);
