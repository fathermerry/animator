import type { Project } from "@/types/project";
import type { AssetBundle, KitAsset } from "@/types/styleConfig";

import { OPENAI_IMAGE_PROMPT_MAX_CHARS, truncateTailWithNote } from "./buildFrameImagePrompt";

export { OPENAI_IMAGE_PROMPT_MAX_CHARS };

/** Server writes DALL·E 3 output at this square size (`/api/render-frame`). */
export const KIT_ASSET_RENDER_IMAGE_SIZE = 1024;

export type KitAssetKind = "characters" | "objects";

/** Stable id passed to `/api/render-frame` as `frameId` (filename under `public/renders/{projectId}/`). */
export function kitAssetRenderFrameId(kind: KitAssetKind, assetId: string): string {
  return `kit-${kind}-${assetId}`;
}

function sharedLookBlock(bundle: AssetBundle): string {
  const textStyleHints = bundle.textStyles.map((t) => t.instructions.trim()).filter(Boolean);
  const lines: string[] = [
    "## Shared style (match across every kit asset)",
    bundle.description.trim()
      ? `Overall style direction: ${bundle.description.trim()}`
      : "",
    textStyleHints.length
      ? `Typography / caption vibe (for mood only — do not render text): ${textStyleHints.join("; ")}`
      : "",
    bundle.notes.trim() ? `Additional kit notes: ${bundle.notes.trim()}` : "",
  ];
  return lines.filter((x) => x !== "").join("\n");
}

function kitAssetBody(
  bundle: AssetBundle,
  kind: KitAssetKind,
  asset: KitAsset,
): string {
  const name = asset.name.trim() || "(unnamed)";
  const idLine = `Kit id: ${asset.id}`;
  const look = sharedLookBlock(bundle);

  const fixed: string[] = [
    "Generate a single high-quality square (1:1 aspect ratio) image for a style-kit asset library used in finance YouTube videos.",
    "Composition: full-frame solid white background (#FFFFFF) only — no gradients, no off-white, no paper texture unless the style direction explicitly requires it.",
    "Center the subject with comfortable margins; clean product-style isolation. Photoreal or polished 3D look consistent with the shared style direction; broadcast-safe lighting.",
    "No text overlays, watermarks, logos, captions, or letters in the image.",
    "",
    "## This asset",
    kind === "characters" ? "Type: Character" : "Type: Object / graphic",
    idLine,
    `Name: ${name}`,
  ];

  if (kind === "characters" && asset.description?.trim()) {
    fixed.push(`Description: ${asset.description.trim()}`);
  }

  fixed.push("", look);

  return fixed.filter((x) => x !== "").join("\n");
}

/**
 * Full prompt for one kit asset image, with the same brief-trimming strategy as frame stills.
 */
export function buildKitAssetImagePrompt(
  project: Project,
  bundle: AssetBundle,
  kind: KitAssetKind,
  asset: KitAsset,
): string {
  const body = kitAssetBody(bundle, kind, asset);
  const brief = project.prompt.trim();
  const max = OPENAI_IMAGE_PROMPT_MAX_CHARS;

  if (!brief) {
    return truncateTailWithNote(body, max);
  }

  const intro = "## Overall video brief\n\n";
  const sep = "\n\n";
  const overhead = intro.length + sep.length;

  if (overhead + brief.length + body.length <= max) {
    return `${intro}${brief}${sep}${body}`;
  }

  const roomForBrief = max - overhead - body.length;

  if (roomForBrief <= 0) {
    return truncateTailWithNote(body, max);
  }

  if (roomForBrief >= brief.length) {
    return `${intro}${brief}${sep}${body}`;
  }

  const briefPart = `${brief.slice(0, Math.max(0, roomForBrief - 1))}…`;
  return `${intro}${briefPart}${sep}${body}`;
}
