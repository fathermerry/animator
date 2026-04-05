import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Player, type PlayerRef } from "@remotion/player";

import { normalizeHex } from "@/lib/color";
import { buildRenderFilmTimeline, FILM_FPS } from "@/lib/renderFilmTimeline";
import { cn } from "@/lib/utils";
import { FilmComposition } from "@/remotion/FilmComposition";
import type { Frame, Render, Scene } from "@/types/project";
import type { AssetBundle } from "@/types/assetsConfig";

const COMPOSITION_WIDTH = 1920;
const COMPOSITION_HEIGHT = 1080;

type Props = {
  assetBundle: AssetBundle;
  scenes: Scene[];
  frames: Frame[];
  renders: Render[];
  className?: string;
  /** When set, the Remotion player is exposed for seek/play from elsewhere (e.g. frame list hover). */
  filmPlayerRef?: RefObject<PlayerRef | null>;
  /** Fired when the current global film frame changes (playback, scrub, seek). */
  onGlobalFrameChange?: (globalFrame: number) => void;
};

export function RenderFilmPreview({
  assetBundle,
  scenes,
  frames,
  renders,
  className,
  filmPlayerRef,
  onGlobalFrameChange,
}: Props) {
  const localRef = useRef<PlayerRef>(null);
  const playerRef = filmPlayerRef ?? localRef;
  const [uiFrame, setUiFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

  const { segments, totalFrames } = useMemo(
    () => buildRenderFilmTimeline(scenes, frames, renders, assetBundle),
    [scenes, frames, renders, assetBundle],
  );

  const hasTimeline = totalFrames > 0 && segments.length > 0;
  const maxFrame = Math.max(0, totalFrames - 1);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !hasTimeline) return;

    const onFrame = (e: { detail: { frame: number } }) => setUiFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onSeeked = (e: { detail: { frame: number } }) => setUiFrame(e.detail.frame);

    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("seeked", onSeeked);

    setUiFrame(p.getCurrentFrame());
    setPlaying(p.isPlaying());

    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("seeked", onSeeked);
    };
  }, [hasTimeline, totalFrames]);

  useEffect(() => {
    if (!hasTimeline || !onGlobalFrameChange) return;
    onGlobalFrameChange(uiFrame);
  }, [hasTimeline, uiFrame, onGlobalFrameChange]);

  const togglePlay = useCallback(() => {
    playerRef.current?.toggle();
  }, []);

  const onScrub = useCallback(
    (next: number) => {
      const f = Math.max(0, Math.min(maxFrame, next));
      playerRef.current?.seekTo(f);
      setUiFrame(f);
    },
    [maxFrame],
  );

  const bgHex = normalizeHex(assetBundle.background.color);
  const bgSrc = assetBundle.background.src?.trim();

  if (!hasTimeline) {
    return (
      <div className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
        <div
          className="relative box-border aspect-video w-full min-h-0 overflow-hidden border-2 border-dotted border-muted-foreground/45 bg-transparent"
          role="region"
          aria-label="Preview"
        >
          <div className="absolute inset-0 z-0" style={{ backgroundColor: bgHex }} aria-hidden />
          {bgSrc ? (
            <img src={bgSrc} alt="" className="absolute inset-0 z-[1] h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 z-[2] flex items-center justify-center p-4">
            <p className="text-base text-muted-foreground">No scenes to preview</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
      <div
        className="relative box-border aspect-video w-full min-h-0 overflow-hidden border-2 border-dotted border-muted-foreground/45 bg-black"
        role="region"
        aria-label="Film preview"
      >
        <Player
          ref={playerRef}
          key={totalFrames}
          component={FilmComposition}
          durationInFrames={totalFrames}
          compositionWidth={COMPOSITION_WIDTH}
          compositionHeight={COMPOSITION_HEIGHT}
          fps={FILM_FPS}
          controls={false}
          inputProps={{ segments }}
          style={{ width: "100%", height: "100%" }}
          acknowledgeRemotionLicense
        />
      </div>

      <div className="flex w-full min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-none border border-border bg-background text-foreground",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <span className="flex items-center gap-0.5" aria-hidden>
              <span className="h-4 w-1 bg-foreground" />
              <span className="h-4 w-1 bg-foreground" />
            </span>
          ) : (
            <span
              className="ml-0.5 inline-block h-0 w-0 border-y-[7px] border-l-[12px] border-y-transparent border-l-foreground border-r-0"
              aria-hidden
            />
          )}
        </button>

        <input
          type="range"
          className="h-2 min-w-0 flex-1 cursor-pointer accent-foreground"
          min={0}
          max={maxFrame}
          step={1}
          value={uiFrame}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label="Scrub timeline"
          aria-valuemin={0}
          aria-valuemax={maxFrame}
          aria-valuenow={uiFrame}
        />
      </div>
    </div>
  );
}
