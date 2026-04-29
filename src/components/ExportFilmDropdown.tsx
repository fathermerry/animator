import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildSceneVoiceoverSrt, type SceneSrtInput } from "@/lib/buildFilmSrt";
import {
  defaultExportQuality,
  defaultExportSubtitlesOn,
  estimateFilmExportSizeBytes,
  EXPORT_RENDER_QUALITY,
  type ExportRenderQuality,
  formatPredictedFileSize,
} from "@/lib/exportRenderQuality";
import { buildRenderFilmTimeline, FILM_FPS } from "@/lib/renderFilmTimeline";
import { cn } from "@/lib/utils";
import { useProjectStore, selectResolvedStyleBundle } from "@/store/projectStore";
import type { Scene } from "@/types/project";

type Props = {
  className?: string;
};

function toExportScenesForSrt(storeScenes: readonly Scene[]): SceneSrtInput[] {
  return storeScenes.map((s) => ({
    id: s.id,
    index: s.index,
    durationSeconds: s.durationSeconds,
    title: s.title,
    voiceoverText: s.voiceoverText,
    description: s.description,
  }));
}

export function ExportFilmDropdown({ className }: Props) {
  const requestExportJob = useStore(useProjectStore, (s) => s.requestExportJob);
  const exportBusy = useStore(useProjectStore, (s) =>
    s.exportJobs.some((j) => j.status === "processing"),
  );
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const frames = useStore(useProjectStore, (s) => s.frames);
  const renders = useStore(useProjectStore, (s) => s.renders);
  const bundle = useStore(useProjectStore, selectResolvedStyleBundle);

  const [open, setOpen] = useState(false);
  const [quality, setQuality] = useState<ExportRenderQuality>(defaultExportQuality);
  const [includeSubtitles, setIncludeSubtitles] = useState(defaultExportSubtitlesOn);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const { totalFrames, srtTextByteLength } = useMemo(() => {
    const { totalFrames: tf } = buildRenderFilmTimeline(scenes, frames, renders, bundle);
    const srt = buildSceneVoiceoverSrt(toExportScenesForSrt(scenes));
    return {
      totalFrames: tf,
      srtTextByteLength: new TextEncoder().encode(srt).byteLength,
    };
  }, [scenes, frames, renders, bundle]);

  const durationSeconds = useMemo(
    () => (totalFrames > 0 ? totalFrames / FILM_FPS : 0),
    [totalFrames],
  );

  const predictedFor = (q: ExportRenderQuality) =>
    formatPredictedFileSize(
      estimateFilmExportSizeBytes({
        durationSeconds,
        quality: q,
        includeSubtitles,
        srtTextByteLength,
      }),
    );

  const predictedCurrent = useMemo(
    () =>
      formatPredictedFileSize(
        estimateFilmExportSizeBytes({
          durationSeconds,
          quality,
          includeSubtitles,
          srtTextByteLength,
        }),
      ),
    [durationSeconds, quality, includeSubtitles, srtTextByteLength],
  );

  const start = () => {
    void (async () => {
      setOpen(false);
      await requestExportJob({ quality, includeSubtitles });
    })();
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        className="h-9 min-w-0 shrink-0 cursor-pointer gap-1.5 px-3 disabled:cursor-wait"
        onClick={() => {
          if (exportBusy) return;
          setOpen((o) => !o);
        }}
        disabled={exportBusy}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-busy={exportBusy}
        aria-label="Export options"
      >
        {exportBusy ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
        <span className="min-w-0">{exportBusy ? "Exporting…" : "Export"}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </Button>
      {open && !exportBusy ? (
        <div
          role="dialog"
          aria-label="Export film"
          className="border-border/60 absolute right-0 z-[60] mt-1.5 flex w-[min(calc(100vw-1.5rem),20rem)] flex-col gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md"
        >
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground" htmlFor="export-quality">
              Render quality
            </Label>
            <Select
              value={quality}
              onValueChange={(v) => {
                if (v === "draft" || v === "standard" || v === "high") setQuality(v);
              }}
            >
              <SelectTrigger id="export-quality" className="w-full" size="sm" aria-label="Render quality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {EXPORT_RENDER_QUALITY.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.label} · {predictedFor(q.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Predicted file size: <span className="text-foreground">{predictedCurrent}</span>
              {includeSubtitles ? " (MP4 + SRT in ZIP)" : " (MP4 only)"}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-start gap-2 text-base leading-snug">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border border-input"
                checked={includeSubtitles}
                onChange={(e) => setIncludeSubtitles(e.target.checked)}
              />
              <span>Include subtitles (.srt)</span>
            </label>
            <p className="pl-6 text-xs text-muted-foreground">
              When on, the download is a ZIP with video and a matching SRT. When off, you get an MP4 only.
            </p>
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={start}
            disabled={totalFrames <= 0}
            title={totalFrames <= 0 ? "Add scenes and length first" : undefined}
          >
            {includeSubtitles ? "Export ZIP" : "Export MP4"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
