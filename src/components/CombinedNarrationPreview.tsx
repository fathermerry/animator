import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  filmDurationSeconds,
  formatDurationMmSs,
} from "@/lib/filmTime";
import { FILM_FPS } from "@/lib/renderFilmTimeline";
import { cn } from "@/lib/utils";
import type { Scene } from "@/types/project";

type Props = {
  scenes: Scene[];
  className?: string;
};

function resolveAudioUrl(src: string): string {
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

function useAudioDurations(urls: string[]): Record<string, number> {
  const key = urls.join("\0");
  const [durations, setDurations] = useState<Record<string, number>>({});

  useEffect(() => {
    const unique = [...new Set(urls)];
    if (unique.length === 0) {
      setDurations({});
      return;
    }
    let cancelled = false;
    const METADATA_MS = 12_000;
    const loadOne = (url: string) =>
      new Promise<[string, number]>((resolve) => {
        const a = document.createElement("audio");
        a.preload = "metadata";
        const finish = (dur: number) => {
          clearTimeout(timeout);
          a.removeEventListener("loadedmetadata", onMeta);
          a.removeEventListener("error", onErr);
          resolve([url, dur]);
        };
        const onMeta = () => {
          const d = a.duration;
          finish(Number.isFinite(d) && d > 0 ? d : 0);
        };
        const onErr = () => finish(0);
        const timeout = window.setTimeout(() => finish(0), METADATA_MS);
        a.addEventListener("loadedmetadata", onMeta);
        a.addEventListener("error", onErr);
        a.src = url;
        a.load();
      });
    void Promise.all(unique.map(loadOne)).then((pairs) => {
      if (cancelled) return;
      setDurations(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return durations;
}

type PreviewSeg = {
  sceneId: string;
  durationInFrames: number;
  sceneDurSec: number;
  src: string | null;
  playbackRate: number;
  frameStart: number;
};

function buildPreviewSegments(
  ordered: Scene[],
  durationsByUrl: Record<string, number>,
): { segments: PreviewSeg[]; totalFrames: number } {
  let frameStart = 0;
  const segments: PreviewSeg[] = [];

  for (const scene of ordered) {
    const sceneDurSec =
      Number.isFinite(scene.durationSeconds) ? Math.max(0, scene.durationSeconds) : 0;
    if (sceneDurSec <= 0) continue;

    const raw = scene.narrationAudioSrc?.trim() || null;
    const src = raw ? resolveAudioUrl(raw) : null;
    const frames = Math.max(1, Math.round(sceneDurSec * FILM_FPS));

    let playbackRate = 1;
    if (src) {
      const audioDur = durationsByUrl[src];
      if (audioDur != null && audioDur > 0 && sceneDurSec > 0) {
        playbackRate = audioDur / sceneDurSec;
      }
    }

    segments.push({
      sceneId: scene.id,
      durationInFrames: frames,
      sceneDurSec,
      src,
      playbackRate,
      frameStart,
    });
    frameStart += frames;
  }

  const totalFrames = segments.reduce((acc, s) => acc + s.durationInFrames, 0);
  return { segments, totalFrames };
}

function segmentIndexForFrame(segments: PreviewSeg[], frame: number): number {
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (frame < s.frameStart + s.durationInFrames) return i;
  }
  return Math.max(0, segments.length - 1);
}

/** Full-story narration: native `<audio>` (same as per-scene preview), frame-locked scrubber. */
export function CombinedNarrationPreview({ scenes, className }: Props) {
  const ordered = useMemo(
    () => [...scenes].sort((a, b) => a.index - b.index),
    [scenes],
  );

  const totalSecFromScenes = useMemo(() => filmDurationSeconds(ordered), [ordered]);
  const hasAnyNarration = useMemo(
    () => ordered.some((s) => Boolean(s.narrationAudioSrc?.trim())),
    [ordered],
  );

  const narrationUrls = useMemo(() => {
    const out: string[] = [];
    for (const s of ordered) {
      const raw = s.narrationAudioSrc?.trim();
      if (raw) out.push(resolveAudioUrl(raw));
    }
    return out;
  }, [ordered]);

  const durationsByUrl = useAudioDurations(narrationUrls);

  const metadataReady = useMemo(() => {
    for (const url of narrationUrls) {
      if (!(url in durationsByUrl)) return false;
    }
    return true;
  }, [narrationUrls, durationsByUrl]);

  const { segments, totalFrames } = useMemo(
    () => buildPreviewSegments(ordered, durationsByUrl),
    [ordered, durationsByUrl],
  );

  const totalSec = totalFrames > 0 ? totalFrames / FILM_FPS : 0;
  const maxFrame = Math.max(0, totalFrames - 1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const rafRef = useRef(0);
  const lastWallRef = useRef(0);
  const frameRef = useRef(0);
  const segmentsRef = useRef(segments);
  const maxFrameRef = useRef(maxFrame);
  segmentsRef.current = segments;
  maxFrameRef.current = maxFrame;

  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

  frameRef.current = currentFrame;

  const scrubFrame = Math.min(Math.max(0, currentFrame), maxFrame);

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const syncAudioToFrame = useCallback((frame: number, opts?: { play?: boolean }) => {
    const el = audioRef.current;
    const segs = segmentsRef.current;
    if (!el || segs.length === 0) return;

    const i = segmentIndexForFrame(segs, frame);
    const seg = segs[i]!;
    const localFrame = frame - seg.frameStart;
    const t =
      seg.durationInFrames > 0
        ? (localFrame / seg.durationInFrames) * seg.sceneDurSec
        : 0;
    const clampedT = Math.max(0, Math.min(seg.sceneDurSec, t));

    if (!seg.src || seg.playbackRate <= 0) {
      el.pause();
      el.removeAttribute("src");
      el.load();
      return;
    }

    const targetTime = clampedT * seg.playbackRate;
    const url = seg.src;

    const applySeek = () => {
      el.playbackRate = seg.playbackRate;
      el.currentTime = targetTime;
      if (opts?.play) {
        void el.play().catch(() => {
          setPlaying(false);
          playingRef.current = false;
        });
      } else {
        el.pause();
      }
    };

    try {
      const cur = new URL(el.currentSrc || el.src, window.location.origin).pathname;
      const want = new URL(url, window.location.origin).pathname;
      const sameResource = cur === want;
      if (!sameResource) {
        el.src = url;
        el.load();
        const onReady = () => {
          el.removeEventListener("loadeddata", onReady);
          el.removeEventListener("canplay", onReady);
          applySeek();
        };
        el.addEventListener("loadeddata", onReady, { once: true });
        el.addEventListener("canplay", onReady, { once: true });
      } else {
        applySeek();
      }
    } catch {
      if (el.src !== url) {
        el.src = url;
        el.load();
        const onReady = () => {
          el.removeEventListener("loadeddata", onReady);
          el.removeEventListener("canplay", onReady);
          applySeek();
        };
        el.addEventListener("loadeddata", onReady, { once: true });
        el.addEventListener("canplay", onReady, { once: true });
      } else {
        applySeek();
      }
    }
  }, []);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (!playing) {
      stopRaf();
      return;
    }

    lastWallRef.current = performance.now();

    const tick = () => {
      if (!playingRef.current) return;

      const el = audioRef.current;
      const segs = segmentsRef.current;
      const maxF = maxFrameRef.current;
      let frame = frameRef.current;
      const i = segmentIndexForFrame(segs, frame);
      const seg = segs[i]!;

      if (seg.src && seg.playbackRate > 0) {
        if (!el) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        /* Waiting for load / play() — do not use the silent-timeline branch */
        if (el.paused) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        if (Number.isFinite(el.currentTime)) {
          const elapsedInScene = el.currentTime / seg.playbackRate;
          if (elapsedInScene >= seg.sceneDurSec - 0.03) {
            const nextFrame = seg.frameStart + seg.durationInFrames;
            if (nextFrame > maxF) {
              setPlaying(false);
              playingRef.current = false;
              el.pause();
              return;
            }
            frameRef.current = nextFrame;
            setCurrentFrame(nextFrame);
            syncAudioToFrame(nextFrame, { play: true });
            lastWallRef.current = performance.now();
          } else {
            const frac = Math.min(1, Math.max(0, elapsedInScene / seg.sceneDurSec));
            const localF = Math.round(frac * (seg.durationInFrames - 1));
            const nf = seg.frameStart + localF;
            if (nf !== frame) {
              frameRef.current = nf;
              setCurrentFrame(nf);
            }
          }
        }
      } else {
        const now = performance.now();
        const dt = (now - lastWallRef.current) / 1000;
        lastWallRef.current = now;
        let next = Math.min(maxF, frame + dt * FILM_FPS);
        const segEndFrame = seg.frameStart + seg.durationInFrames - 1;
        if (next >= segEndFrame) {
          const after = seg.frameStart + seg.durationInFrames;
          if (after > maxF) {
            setPlaying(false);
            playingRef.current = false;
            return;
          }
          frameRef.current = after;
          setCurrentFrame(after);
          syncAudioToFrame(after, { play: true });
          lastWallRef.current = now;
        } else {
          frameRef.current = next;
          setCurrentFrame(next);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      stopRaf();
    };
  }, [playing, stopRaf, syncAudioToFrame]);

  const seekFrame = useCallback(
    (next: number) => {
      const f = Math.max(0, Math.min(maxFrame, Math.round(next)));
      frameRef.current = f;
      setCurrentFrame(f);
      setPlaying(false);
      playingRef.current = false;
      stopRaf();
      syncAudioToFrame(f, { play: false });
    },
    [maxFrame, syncAudioToFrame, stopRaf],
  );

  const togglePlay = useCallback(() => {
    if (totalFrames <= 0) return;
    if (playing) {
      setPlaying(false);
      playingRef.current = false;
      stopRaf();
      audioRef.current?.pause();
      return;
    }
    const atEnd = scrubFrame >= maxFrame && maxFrame > 0;
    const f = atEnd ? 0 : scrubFrame;
    if (atEnd) {
      frameRef.current = 0;
      setCurrentFrame(0);
    }
    lastWallRef.current = performance.now();
    setPlaying(true);
    playingRef.current = true;
    syncAudioToFrame(f, { play: true });
  }, [playing, scrubFrame, maxFrame, totalFrames, syncAudioToFrame, stopRaf]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !playing) return;

    const onEnded = () => {
      const segs = segmentsRef.current;
      const maxF = maxFrameRef.current;
      const frame = frameRef.current;
      const i = segmentIndexForFrame(segs, frame);
      const seg = segs[i]!;
      if (!seg.src) return;
      const nextFrame = seg.frameStart + seg.durationInFrames;
      if (nextFrame > maxF) {
        setPlaying(false);
        playingRef.current = false;
        return;
      }
      frameRef.current = nextFrame;
      setCurrentFrame(nextFrame);
      syncAudioToFrame(nextFrame, { play: true });
      lastWallRef.current = performance.now();
    };

    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [playing, syncAudioToFrame]);

  const globalSec = scrubFrame / FILM_FPS;
  const displayTotalSec = totalSec > 0 ? totalSec : totalSecFromScenes;

  if (ordered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        No scenes yet.
      </p>
    );
  }

  if (totalSecFromScenes <= 0) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Set a duration for at least one scene to preview narration.
      </p>
    );
  }

  if (!hasAnyNarration) {
    return (
      <p className="text-sm text-muted-foreground">
        No narration audio yet. Generate it per scene in the list below.
      </p>
    );
  }

  if (!metadataReady || segments.length === 0 || totalFrames <= 0) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading narration…
      </p>
    );
  }

  const rangeId = "combined-narration-scrub";

  return (
    <div className={cn("relative flex min-w-0 flex-col gap-2", className)}>
      <audio ref={audioRef} preload="metadata" className="hidden" aria-hidden />

      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background px-3 text-base text-foreground",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-pressed={playing}
          aria-label={playing ? "Pause combined narration" : "Play combined narration"}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={rangeId} className="sr-only">
            Position in full story
          </label>
          <input
            id={rangeId}
            type="range"
            min={0}
            max={maxFrame}
            step={1}
            value={scrubFrame}
            disabled={maxFrame <= 0}
            onChange={(e) => {
              seekFrame(Number(e.target.value));
            }}
            className="h-2 w-full min-w-0 cursor-pointer accent-foreground disabled:cursor-not-allowed"
          />
          <div className="flex justify-between tabular-nums text-muted-foreground">
            <span>{formatDurationMmSs(globalSec)}</span>
            <span>{formatDurationMmSs(displayTotalSec)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
