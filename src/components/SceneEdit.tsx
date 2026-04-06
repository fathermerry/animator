import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDurationMmSs } from "@/lib/filmTime";
import { panelHeadingAfterBlockClass } from "@/lib/panelHeading";
import { cn } from "@/lib/utils";
import type { Scene } from "@/types/project";

type Props = {
  scene: Scene | null;
  disabled?: boolean;
  generatingAll: boolean;
  generatingThis: boolean;
  narrationError: string | null;
  onVoiceoverChange: (value: string) => void;
  onGenerateThis: () => void;
  onGenerateAll: () => void;
};

/** Scene length, transcript, and narration for the Story step. */
export function SceneEdit({
  scene,
  disabled = false,
  generatingAll,
  generatingThis,
  narrationError,
  onVoiceoverChange,
  onGenerateThis,
  onGenerateAll,
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

  if (!scene) {
    return (
      <Card className="min-w-0" size="sm">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground" role="status">
            Select a scene to edit length, transcript, and audio.
          </p>
        </CardContent>
      </Card>
    );
  }

  const title = scene.title.trim() || `Scene ${scene.index + 1}`;

  return (
    <Card className="min-w-0" size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4 pt-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className={panelHeadingAfterBlockClass}>Scene length</p>
          <p className="text-base tabular-nums text-foreground">{formatDurationMmSs(scene.durationSeconds)}</p>
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

        <div className="flex min-w-0 flex-col gap-2" aria-label="Narration">
          <p className={panelHeadingAfterBlockClass}>Audio</p>
          {audioSrc ? (
            <audio controls className="w-full min-w-0" preload="metadata" src={resolvedAudio} />
          ) : (
            <p className="text-sm text-muted-foreground">No narration generated.</p>
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <button
              type="button"
              disabled={disabled || generatingAll || generatingThis || !scene.voiceoverText?.trim()}
              onClick={onGenerateThis}
              className={cn(
                "w-full rounded-md border border-border bg-background px-3 py-2 text-left text-base text-foreground",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {generatingThis ? "Generating narration…" : "Generate narration for this scene"}
            </button>
            <button
              type="button"
              disabled={disabled || generatingAll}
              onClick={onGenerateAll}
              className={cn(
                "w-full rounded-md border border-border bg-background px-3 py-2 text-left text-base text-foreground",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {generatingAll ? "Generating narration…" : "Generate narration for all scenes"}
            </button>
          </div>
          {narrationError ? (
            <p className="text-sm text-destructive" role="alert">
              {narrationError}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
