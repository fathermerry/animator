import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
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
  /** Current global film frame (playback, scrub, layer click seeks). */
  globalFrame: number;
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
  globalFrame,
  onGlobalFrameChange,
}: Props) {
  const localRef = useRef<PlayerRef>(null);
  const playerRef = filmPlayerRef ?? localRef;
  const [playing, setPlaying] = useState(false);

  const { segments, totalFrames } = useMemo(
    () => buildRenderFilmTimeline(scenes, frames, renders, assetBundle),
    [scenes, frames, renders, assetBundle],
  );

  /** Remount player when generated still URLs change so new images appear without a full reload. */
  const stillSignature = useMemo(
    () => segments.map((s) => (s.stillSrc ? `${s.frameId ?? ""}:${s.stillSrc}` : "")).join("|"),
    [segments],
  );

  const hasTimeline = totalFrames > 0 && segments.length > 0;
  const maxFrame = Math.max(0, totalFrames - 1);
  const scrubFrame = Math.min(Math.max(0, globalFrame), maxFrame);

  /** Keep latest scrub position for layout seek without re-subscribing listeners every frame. */
  const scrubFrameRef = useRef(scrubFrame);
  scrubFrameRef.current = scrubFrame;

  /**
   * When `stillSignature` changes we remount the Player so new stills load; without this, the new
   * instance starts at frame 0 while `globalFrame` state still reflects the old playhead — preview
   * and scrub bar disagree and the finished render can appear "missing".
   */
  useLayoutEffect(() => {
    const p = playerRef.current;
    if (!p || !hasTimeline) return;
    p.seekTo(scrubFrameRef.current);
  }, [stillSignature, totalFrames, hasTimeline, playerRef]);

  useEffect(() => {
    if (!hasTimeline || !onGlobalFrameChange) return;
    if (globalFrame > maxFrame) onGlobalFrameChange(maxFrame);
  }, [hasTimeline, maxFrame, globalFrame, onGlobalFrameChange]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !hasTimeline) return;

    const emit = (frame: number) => onGlobalFrameChange?.(frame);
    const onFrame = (e: { detail: { frame: number } }) => emit(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onSeeked = (e: { detail: { frame: number } }) => emit(e.detail.frame);

    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("seeked", onSeeked);

    emit(p.getCurrentFrame());
    setPlaying(p.isPlaying());

    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("seeked", onSeeked);
    };
  }, [hasTimeline, totalFrames, stillSignature, onGlobalFrameChange]);

  const togglePlay = useCallback(() => {
    playerRef.current?.toggle();
  }, []);

  const onScrub = useCallback(
    (next: number) => {
      const f = Math.max(0, Math.min(maxFrame, next));
      playerRef.current?.seekTo(f);
      onGlobalFrameChange?.(f);
    },
    [maxFrame, onGlobalFrameChange],
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
          key={`${totalFrames}-${stillSignature}`}
          component={FilmComposition}
          durationInFrames={totalFrames}
          initialFrame={scrubFrame}
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
          value={scrubFrame}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label="Scrub timeline"
          aria-valuemin={0}
          aria-valuemax={maxFrame}
          aria-valuenow={scrubFrame}
        />
      </div>
    </div>
  );
}
