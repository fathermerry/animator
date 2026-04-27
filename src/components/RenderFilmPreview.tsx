import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { Player, type PlayerRef } from "@remotion/player";

import { normalizeHex } from "@/lib/color";
import { resolveSceneBackground } from "@/lib/sceneBackground";
import { buildRenderFilmTimeline, FILM_FPS, type FilmSegmentInput } from "@/lib/renderFilmTimeline";
import { cn } from "@/lib/utils";
import { FilmComposition } from "@/remotion/FilmComposition";
import type { Frame, Render, Scene } from "@/types/project";
import type { AssetBundle } from "@/types/styleConfig";

const COMPOSITION_WIDTH = 1920;
const COMPOSITION_HEIGHT = 1080;

export type FilmSceneSpan = {
  sceneId: string;
  startFrame: number;
  durationInFrames: number;
};

function sceneSpansFromSegments(segments: FilmSegmentInput[]): FilmSceneSpan[] {
  const spans: FilmSceneSpan[] = [];
  let acc = 0;
  for (const seg of segments) {
    const prev = spans[spans.length - 1];
    if (prev && prev.sceneId === seg.sceneId) {
      prev.durationInFrames += seg.durationInFrames;
    } else {
      spans.push({ sceneId: seg.sceneId, startFrame: acc, durationInFrames: seg.durationInFrames });
    }
    acc += seg.durationInFrames;
  }
  return spans;
}

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
  /** Fired when Remotion play/pause state changes. */
  onPlayingChange?: (playing: boolean) => void;
  playbackDisabled?: boolean;
  /** Caption below the picture (e.g. narration cue synced to the same timeline as audio). */
  outsideCaption?: string;
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
  onPlayingChange,
  playbackDisabled = false,
  outsideCaption,
}: Props) {
  const localRef = useRef<PlayerRef>(null);
  const playerRef = filmPlayerRef ?? localRef;
  const [playing, setPlaying] = useState(false);

  const { segments, totalFrames } = useMemo(
    () => buildRenderFilmTimeline(scenes, frames, renders, assetBundle),
    [scenes, frames, renders, assetBundle],
  );

  const sceneSpans = useMemo(() => sceneSpansFromSegments(segments), [segments]);

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
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

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
    if (playbackDisabled) return;
    playerRef.current?.toggle();
  }, [playbackDisabled]);

  const onScrub = useCallback(
    (next: number) => {
      const f = Math.max(0, Math.min(maxFrame, next));
      playerRef.current?.seekTo(f);
      onGlobalFrameChange?.(f);
    },
    [maxFrame, onGlobalFrameChange],
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const scrubDragRef = useRef<{ pointerId: number; active: boolean } | null>(null);

  const frameFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || maxFrame <= 0) return 0;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const ratio = (clientX - rect.left) / rect.width;
      return Math.round(Math.min(1, Math.max(0, ratio)) * maxFrame);
    },
    [maxFrame],
  );

  const onScrubTrackPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (playbackDisabled || e.button !== 0) return;
      e.preventDefault();
      scrubDragRef.current = { pointerId: e.pointerId, active: true };
      e.currentTarget.setPointerCapture(e.pointerId);
      onScrub(frameFromClientX(e.clientX));
    },
    [frameFromClientX, onScrub, playbackDisabled],
  );

  const onScrubTrackPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = scrubDragRef.current;
      if (!d?.active || d.pointerId !== e.pointerId) return;
      onScrub(frameFromClientX(e.clientX));
    },
    [frameFromClientX, onScrub],
  );

  const endScrubDrag = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const d = scrubDragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    scrubDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const onScrubTrackKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (playbackDisabled) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const delta = e.key === "ArrowLeft" ? -1 : 1;
        const step = e.shiftKey ? Math.max(1, Math.floor(FILM_FPS)) : 1;
        onScrub(scrubFrame + delta * step);
      } else if (e.key === "Home") {
        e.preventDefault();
        onScrub(0);
      } else if (e.key === "End") {
        e.preventDefault();
        onScrub(maxFrame);
      }
    },
    [maxFrame, onScrub, playbackDisabled, scrubFrame],
  );

  const playheadPct = maxFrame > 0 ? (scrubFrame / maxFrame) * 100 : 0;

  const firstScene = useMemo(() => {
    if (scenes.length === 0) return null;
    return [...scenes].sort((a, b) => a.index - b.index)[0] ?? null;
  }, [scenes]);
  const emptyPlate = resolveSceneBackground(firstScene, assetBundle);
  const bgHex = normalizeHex(emptyPlate.color);
  const bgSrc = emptyPlate.src?.trim();

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
            <p className="text-base text-muted-foreground">Nothing to preview yet</p>
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

      {outsideCaption != null && outsideCaption.trim() !== "" ? (
        <p
          className="mx-auto w-full max-w-[min(100%,42rem)] rounded-md border border-white/10 bg-black/88 px-4 py-2.5 text-center text-sm font-medium leading-snug tracking-wide text-white shadow-md [text-wrap:balance]"
          role="status"
          aria-live="polite"
        >
          {outsideCaption.trim()}
        </p>
      ) : null}

      <div className="flex w-full min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={playbackDisabled}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-none border border-border bg-background text-foreground",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-background",
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

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div
            ref={trackRef}
            role="slider"
            tabIndex={playbackDisabled ? -1 : 0}
            aria-label="Scrub timeline"
            aria-valuemin={0}
            aria-valuemax={maxFrame}
            aria-valuenow={scrubFrame}
            aria-disabled={playbackDisabled}
            className={cn(
              "relative h-9 min-w-0 shrink-0 rounded-sm border border-border bg-muted/20 outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              playbackDisabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
            )}
            onPointerDown={onScrubTrackPointerDown}
            onPointerMove={onScrubTrackPointerMove}
            onPointerUp={endScrubDrag}
            onPointerCancel={endScrubDrag}
            onKeyDown={onScrubTrackKeyDown}
          >
            <div className="absolute inset-0 flex min-h-0 min-w-0 flex-row overflow-hidden rounded-[inherit]" aria-hidden>
              {sceneSpans.map((span, i) => (
                <div
                  key={`${span.sceneId}-${span.startFrame}`}
                  className={cn(
                    "h-full min-w-0 border-r border-border/50 last:border-r-0",
                    i % 2 === 0 ? "bg-muted/35" : "bg-muted/20",
                  )}
                  style={{ flex: span.durationInFrames }}
                />
              ))}
            </div>
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-[1] w-px -translate-x-1/2 bg-foreground shadow-[0_0_0_1px_hsl(var(--background))]"
              style={{ left: `${playheadPct}%` }}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}
