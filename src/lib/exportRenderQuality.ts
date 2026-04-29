const AUDIO_MBPS = 0.192;
/** H.264 @ 1920×30fps rough Mbps used only for file-size hints (real output varies with content). */
const QUALITY_VIDEO_MBPS: Record<ExportRenderQuality, number> = {
  draft: 3.2,
  standard: 6.5,
  high: 13,
};

const ZIP_OVERHEAD = 1.04;

export type ExportRenderQuality = "draft" | "standard" | "high";

export const EXPORT_RENDER_QUALITY: {
  id: ExportRenderQuality;
  label: string;
  crf: number;
}[] = [
  { id: "draft", label: "Draft (smaller file)", crf: 28 },
  { id: "standard", label: "Standard (balanced)", crf: 23 },
  { id: "high", label: "High (larger, sharper)", crf: 18 },
];

export function getCrfForExportQuality(quality: ExportRenderQuality): number {
  return EXPORT_RENDER_QUALITY.find((q) => q.id === quality)?.crf ?? 23;
}

export function isExportRenderQuality(s: string): s is ExportRenderQuality {
  return s === "draft" || s === "standard" || s === "high";
}

/**
 * Heuristic file-size estimate for the encoded MP4 (video + AAC) plus optional SRT + ZIP.
 */
export function estimateFilmExportSizeBytes(input: {
  durationSeconds: number;
  quality: ExportRenderQuality;
  includeSubtitles: boolean;
  srtTextByteLength: number;
}): number {
  const { durationSeconds, quality, includeSubtitles, srtTextByteLength } = input;
  const t = Math.max(0, Number.isFinite(durationSeconds) ? durationSeconds : 0);
  const videoBps = QUALITY_VIDEO_MBPS[quality] * 1_000_000;
  const audioBps = AUDIO_MBPS * 1_000_000;
  const mp4Bytes = (t * (videoBps + audioBps)) / 8;
  if (!includeSubtitles) {
    return Math.max(0, Math.round(mp4Bytes));
  }
  const srt = Math.max(0, srtTextByteLength);
  return Math.max(0, Math.round((mp4Bytes + srt) * ZIP_OVERHEAD));
}

export function formatPredictedFileSize(bytes: number): string {
  if (bytes < 1024) return `~${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) {
    return `~${(bytes / 1024).toFixed(0)} KB`;
  }
  return `~${mb.toFixed(1)} MB`;
}

export function defaultExportSubtitlesOn(): boolean {
  return true;
}

export function defaultExportQuality(): ExportRenderQuality {
  return "standard";
}
