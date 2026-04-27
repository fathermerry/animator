import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

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

export type RenderFilmToMp4Result = {
  /** URL path the browser can open (e.g. `/exports/foo.mp4`) */
  publicPath: string;
  absoluteFilePath: string;
};

/**
 * Renders the film Remotion composition to an H.264 MP4 and writes it under `public/exports/`.
 */
export async function renderFilmToMp4(options: {
  segments: FilmSegmentInput[];
  /** Scene ids and narration MP3 paths (as stored in the project; absolutized for Remotion). */
  scenes: { id: string; narrationAudioSrc?: string }[];
  assetBaseUrl: string;
  fileLabel: string;
}): Promise<RenderFilmToMp4Result> {
  const { assetBaseUrl, fileLabel, segments: raw, scenes: rawScenes } = options;
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
  const outName = `${baseName}-${Date.now()}.mp4`;
  const outPath = path.join(outDir, outName);

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
    outputLocation: outPath,
    logLevel: "error",
  });

  return {
    publicPath: `/exports/${outName}`,
    absoluteFilePath: outPath,
  };
}
