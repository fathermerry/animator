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
    "Use these only to style the single subject (line weight, palette, character of line) — do not introduce icons, diagrams, or extra objects.",
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

/** Fixed visual contract for every kit asset image; bundle details refine but do not replace this. */
function kitAssetStandardPrompt(kind: KitAssetKind): string {
  const base: string[] = [
    "Generate a single high-quality square (1:1 aspect ratio) image for a style-kit asset library.",
    "Composition: full-frame solid white background (#FFFFFF) only — no gradients, no off-white, no paper texture unless the shared style direction explicitly requires it.",
    "Center the subject with comfortable margins.",
    "Single subject only — no crowds, no secondary figures, no diorama or scene staging.",
    "Exactly one drawable subject in the entire frame. The rest of the image is empty white only — no floating icons, no decorative symbols, no charts or graphs, no UI mockups, phones, play buttons, megaphones, infographic ornaments, or collage elements. Do not compose a marketing hero, explainer layout, or icon ring around the subject.",
    "2D illustration look (flat colors or soft cel-style shading), clear readable silhouette — not photoreal 3D, not a cinematic environment shot, not a product photo with realistic scene lighting unless the shared style direction explicitly overrides.",
    "No text overlays, watermarks, logos, captions, letters, or readable symbols in the image.",
  ];

  if (kind === "characters") {
    base.push(
      "One character only. No furniture, electronics, charts, documents, floor plane, or extra props — except clothing and accessories worn on the body.",
      "Use the description below only for the character's appearance, pose, and outfit; do not draw props, settings, or metaphors mentioned for story context.",
    );
  } else {
    base.push(
      "One isolated object or graphic only — no surrounding scene, desk, environment, or extra pictograms.",
    );
  }

  return base.join("\n");
}

function thisAssetBlock(kind: KitAssetKind, asset: KitAsset): string {
  const name = asset.name.trim() || "(unnamed)";
  const lines: string[] = [
    "## This asset",
    kind === "characters" ? "Type: Character" : "Type: Object / graphic",
    `Kit id: ${asset.id}`,
    `Name: ${name}`,
  ];
  if (kind === "characters" && asset.description?.trim()) {
    lines.push(`Description: ${asset.description.trim()}`);
  }
  return lines.join("\n");
}

function kitAssetBody(bundle: AssetBundle, kind: KitAssetKind, asset: KitAsset): string {
  const standard = kitAssetStandardPrompt(kind);
  const look = sharedLookBlock(bundle);
  const assetBlock = thisAssetBlock(kind, asset);
  return [standard, look, assetBlock].join("\n\n");
}

/**
 * Full prompt for one kit asset image. Does not include the project script — only the standard
 * kit contract, shared bundle style, and this asset's fields.
 */
export function buildKitAssetImagePrompt(
  _project: Project,
  bundle: AssetBundle,
  kind: KitAssetKind,
  asset: KitAsset,
): string {
  const body = kitAssetBody(bundle, kind, asset);
  return truncateTailWithNote(body, OPENAI_IMAGE_PROMPT_MAX_CHARS);
}
