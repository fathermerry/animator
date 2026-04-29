import { createWriteStream } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import archiver from "archiver";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

import { getCrfForExportQuality, type ExportRenderQuality } from "../src/lib/exportRenderQuality.ts";
import { buildSceneVoiceoverSrt, type SceneSrtInput } from "../src/lib/buildFilmSrt.ts";
import { buildNarrationExportClips } from "../src/lib/filmNarrationExport.ts";
import { absolutizeFilmExportSegments, absolutizeNarrationSceneMeta } from "../src/lib/filmExportUrls.ts";
import type { FilmSegmentInput } from "../src/lib/renderFilmTimeline.ts";
import type { FilmForExportProps } from "../src/remotion/FilmForExportComposition.tsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const compositionId = "Film" as const;

let cachedBundleUrl: string | null = null;

function webpackWithAlias(
  c: import("webpack").Configuration,
): import("webpack").Configuration {
  const resolve = c.resolve ?? {};
  const prior = resolve.alias;
  const alias: Record<string, string | false | string[]> = {};
  if (prior && !Array.isArray(prior) && typeof prior === "object") {
    Object.assign(alias, prior as Record<string, string | false | string[]>);
  }
  alias["@"] = path.join(repoRoot, "src");
  return { ...c, resolve: { ...resolve, alias } };
}

export async function getOrCreateRemotionBundleUrl(): Promise<string> {
  if (cachedBundleUrl) return cachedBundleUrl;
  const entryPoint = path.join(repoRoot, "src", "remotion", "RemotionRoot.tsx");
  const serveUrl = await bundle({
    entryPoint,
    rootDir: repoRoot,
    publicDir: path.join(repoRoot, "public"),
    webpackOverride: webpackWithAlias,
    logLevel: "error" as const,
  });
  cachedBundleUrl = serveUrl;
  return serveUrl;
}

function safeFileSegment(s: string): string {
  return s.replace(/[^\w\-.()]+/g, "-").replace(/^-+|-+$/g, "") || "export";
}

export type FilmExportResult = {
  publicPath: string;
  outputKind: "mp4" | "zip";
};

async function createZipWithVideoAndSrt(
  videoAbsolutePath: string,
  srtText: string,
  zipPath: string,
  baseName: string,
): Promise<void> {
  const out = createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  const done = new Promise<void>((resolve, reject) => {
    out.on("close", () => resolve());
    out.on("error", reject);
    archive.on("error", reject);
  });
  archive.pipe(out);
  archive.file(videoAbsolutePath, { name: `${baseName}.mp4` });
  archive.append(srtText, { name: `${baseName}.srt` });
  await archive.finalize();
  await done;
}

/**
 * Renders the full film, then either publishes an MP4 only or a ZIP of MP4 + SRT.
 */
export async function exportFilm(options: {
  segments: FilmSegmentInput[];
  scenes: { id: string; narrationAudioSrc?: string }[];
  exportScenes: SceneSrtInput[];
  assetBaseUrl: string;
  fileLabel: string;
  quality: ExportRenderQuality;
  includeSubtitles: boolean;
}): Promise<FilmExportResult> {
  const {
    assetBaseUrl,
    fileLabel,
    segments: raw,
    scenes: rawScenes,
    exportScenes,
    quality,
    includeSubtitles,
  } = options;
  const segments = absolutizeFilmExportSegments(raw, assetBaseUrl);
  const sceneMeta = absolutizeNarrationSceneMeta(rawScenes, assetBaseUrl);
  if (segments.length === 0) {
    throw new Error("Cannot export: film timeline is empty");
  }
  const totalDuration = segments.reduce((acc, s) => acc + s.durationInFrames, 0);
  if (totalDuration <= 0) {
    throw new Error("Cannot export: total duration is zero");
  }
  const narrationClips = buildNarrationExportClips(segments, sceneMeta);

  const serveUrl = await getOrCreateRemotionBundleUrl();
  const outDir = path.join(repoRoot, "public", "exports");
  await mkdir(outDir, { recursive: true });
  const baseName = safeFileSegment(fileLabel.trim() || "film");
  const stamp = Date.now();
  const videoName = `${baseName}-render-${stamp}.mp4`;
  const videoPath = path.join(outDir, videoName);
  const crf = getCrfForExportQuality(quality);

  const inputProps: FilmForExportProps = { segments, narrationClips };
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
    logLevel: "error",
  });

  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    crf,
    outputLocation: videoPath,
    logLevel: "error",
  });

  if (!includeSubtitles) {
    const outName = `${baseName}-${stamp}.mp4`;
    const outPath = path.join(outDir, outName);
    await rename(videoPath, outPath);
    return { publicPath: `/exports/${outName}`, outputKind: "mp4" };
  }

  const srt = buildSceneVoiceoverSrt(exportScenes);
  const zipName = `${baseName}-${stamp}.zip`;
  const zipPath = path.join(outDir, zipName);
  await createZipWithVideoAndSrt(videoPath, srt, zipPath, baseName);
  try {
    await unlink(videoPath);
  } catch {
    /* best-effort */
  }
  return { publicPath: `/exports/${zipName}`, outputKind: "zip" };
}
