import { useEffect, useMemo, useRef, useState } from "react";

import { formatDurationMmSs } from "@/lib/filmTime";
import { panelHeadingAfterBlockClass } from "@/lib/panelHeading";
import { cn } from "@/lib/utils";
import type { Scene } from "@/types/project";

const MAX_DURATION_SEC = 24 * 60 * 60;

type Props = {
  scene: Scene | null;
  /** `inline` = under a scene row (no duplicate title header). */
  variant?: "panel" | "inline";
  disabled?: boolean;
  onVoiceoverChange: (value: string) => void;
  onDurationChange: (durationSeconds: number) => void;
  /** Generate narration from transcript (e.g. POST /api/narration). */
  onGenerateAudio?: () => void;
  generatingAudio?: boolean;
  narrationError?: string | null;
};

/** Scene length, transcript, and narration audio for the Story step. */
export function SceneEdit({
  scene,
  variant = "panel",
  disabled = false,
  onVoiceoverChange,
  onDurationChange,
  onGenerateAudio,
  generatingAudio = false,
  narrationError = null,
}: Props) {
  const audioSrc = scene?.narrationAudioSrc?.trim();
  const resolvedAudio = useMemo(() => {
    if (!audioSrc) return "";
    try {
      return new URL(audioSrc, window.location.origin).href;
    } catch {
      return audioSrc;
    }
  }, [audioSrc]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setPlaying(false);
  }, [resolvedAudio]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [resolvedAudio]);

  if (!scene) {
    return (
      <div className="min-w-0 px-4 py-4">
        <p className="text-sm text-muted-foreground" role="status">
          Select a scene to edit length and transcript.
        </p>
      </div>
    );
  }

  const title = scene.title.trim() || `Scene ${scene.index + 1}`;
  const isInline = variant === "inline";
  const hasTranscript = Boolean(scene.voiceoverText?.trim());

  const totalSec = Number.isFinite(scene.durationSeconds)
    ? Math.max(0, Math.floor(scene.durationSeconds))
    : 0;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  function applyTotal(nextTotal: number) {
    const t = Math.max(0, Math.min(Math.floor(nextTotal), MAX_DURATION_SEC));
    onDurationChange(t);
  }

  const inputClass = cn(
    "w-16 shrink-0 rounded-md border border-border/80 bg-background px-2 py-1.5 text-base tabular-nums text-foreground shadow-none outline-none ring-0",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
    disabled && "cursor-not-allowed opacity-60",
  );

  const controlBtnClass = cn(
    "block min-h-[2.25rem] w-full min-w-0 rounded-md border border-border/80 bg-background px-2 py-1.5 text-center text-base leading-none text-foreground",
    "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:pointer-events-none disabled:opacity-50",
  );

  function togglePlayback() {
    const el = audioRef.current;
    if (!el || !resolvedAudio) return;
    if (playing) {
      el.pause();
      el.currentTime = 0;
      setPlaying(false);
    } else {
      void el.play().catch(() => setPlaying(false));
    }
  }

  return (
    <div className="flex min-w-0 flex-col">
      {isInline ? null : (
        <div className="border-b border-border/60 px-4 pb-3 pt-4">
          <h2 className="text-base font-semibold leading-none text-foreground">{title}</h2>
        </div>
      )}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-3",
          isInline ? "px-0 py-0" : "px-4 pb-4 pt-4",
        )}
      >
        <div
          className="flex w-full min-w-0 flex-wrap items-end gap-x-4 gap-y-2"
          role="group"
          aria-label={`Duration ${formatDurationMmSs(totalSec)}, audio`}
        >
          <div className="flex shrink-0 flex-col gap-1">
            <label
              htmlFor={`scene-length-min-${scene.id}`}
              className="text-sm text-muted-foreground"
            >
              Minutes
            </label>
            <input
              id={`scene-length-min-${scene.id}`}
              type="number"
              min={0}
              max={Math.floor(MAX_DURATION_SEC / 60)}
              step={1}
              disabled={disabled}
              value={minutes}
              onChange={(e) => {
                const raw = e.target.value;
                const m =
                  raw === ""
                    ? 0
                    : Math.max(0, Math.min(Math.floor(MAX_DURATION_SEC / 60), parseInt(raw, 10) || 0));
                applyTotal(m * 60 + seconds);
              }}
              className={inputClass}
            />
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <label
              htmlFor={`scene-length-sec-${scene.id}`}
              className="text-sm text-muted-foreground"
            >
              Seconds
            </label>
            <input
              id={`scene-length-sec-${scene.id}`}
              type="number"
              min={0}
              max={59}
              step={1}
              disabled={disabled}
              value={seconds}
              onChange={(e) => {
                const raw = e.target.value;
                const s =
                  raw === ""
                    ? 0
                    : Math.max(0, Math.min(59, Math.floor(parseInt(raw, 10) || 0)));
                applyTotal(minutes * 60 + s);
              }}
              className={inputClass}
            />
          </div>
          <div className="flex min-w-0 flex-1 basis-0 flex-col gap-1">
            <span className="text-sm text-muted-foreground">Audio</span>
            {resolvedAudio ? (
              <>
                <audio ref={audioRef} preload="metadata" src={resolvedAudio} className="hidden" />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={togglePlayback}
                  className={controlBtnClass}
                  aria-pressed={playing}
                >
                  {playing ? "Stop" : "Play"}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={
                  disabled ||
                  generatingAudio ||
                  !hasTranscript ||
                  !onGenerateAudio
                }
                onClick={() => onGenerateAudio?.()}
                className={controlBtnClass}
              >
                {generatingAudio ? "Generating…" : "Generate"}
              </button>
            )}
            {narrationError ? (
              <p className="text-sm text-destructive" role="alert">
                {narrationError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <p className={panelHeadingAfterBlockClass}>Transcript</p>
          <textarea
            value={scene.voiceoverText ?? ""}
            onChange={(e) => onVoiceoverChange(e.target.value)}
            disabled={disabled}
            placeholder="No transcript"
            spellCheck
            rows={6}
            className={cn(
              "min-h-0 w-full min-w-0 resize-y bg-background text-sm leading-relaxed text-muted-foreground",
              "border border-border/80 rounded-md px-3 py-2 shadow-none outline-none ring-0",
              "focus-visible:ring-2 focus-visible:ring-ring",
              "placeholder:text-muted-foreground/50",
              disabled && "cursor-not-allowed opacity-60",
            )}
            aria-label={`Transcript, ${title}`}
          />
        </div>
      </div>
    </div>
  );
}
