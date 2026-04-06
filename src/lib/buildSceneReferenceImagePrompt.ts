import { resolveSceneBackground } from "@/lib/sceneBackground";
import { OPENAI_IMAGE_PROMPT_MAX_CHARS, truncateTailWithNote } from "@/lib/buildFrameImagePrompt";
import type { Scene } from "@/types/project";
import type { AssetBundle, KitAsset } from "@/types/styleConfig";

export { OPENAI_IMAGE_PROMPT_MAX_CHARS };

/** Stable id for `/api/render-frame` output path (`public/renders/{projectId}/scene-ref-{sceneId}.png`). */
export function sceneRefRenderFrameId(sceneId: string): string {
  return `scene-ref-${sceneId}`;
}

function resolveKitAssets(ids: string[], pool: KitAsset[]): KitAsset[] {
  const out: KitAsset[] = [];
  for (const id of ids) {
    const a = pool.find((x) => x.id === id);
    if (a) out.push(a);
  }
  return out;
}

/**
 * Prompt for a single scene reference still (Style step): widescreen look target for this beat.
 */
export function buildSceneReferenceImagePrompt(scene: Scene, bundle: AssetBundle): string {
  const plate = resolveSceneBackground(scene, bundle);
  const chars = resolveKitAssets(scene.characterIds, bundle.characters);
  const textStyleHints = bundle.textStyles.map((t) => t.instructions.trim()).filter(Boolean);

  const lines: string[] = [
    "Generate a single high-quality widescreen (16:9) keyframe image to use as the visual reference for this scene in a finance YouTube video.",
    "This image defines composition energy, palette, line weight, and illustration language for every generated frame in this scene — treat it as the authoritative look target for this beat.",
    "No text overlays, watermarks, logos, or readable captions unless they are clearly part of a prop in the scene (avoid text when possible).",
    "",
    "## Style contract (binding)",
    bundle.description.trim()
      ? bundle.description.trim()
      : "Use illustrated / explainer graphics consistent with the style kit.",
    bundle.notes.trim() ? `Additional kit constraints: ${bundle.notes.trim()}` : "",
    "",
    "## Scene",
    scene.title.trim() ? `Title: ${scene.title.trim()}` : "Title: (untitled scene)",
    scene.description.trim() ? `Beat / action: ${scene.description.trim()}` : "",
    "",
    "## Cast (in shot)",
  ];

  if (chars.length === 0) {
    lines.push("(No characters selected — environment and props only.)");
  } else {
    lines.push(
      "Render each person below in the same graphic language as the style kit — not as unrelated live-action actors or stock models.",
    );
    for (const c of chars) {
      const desc = c.description?.trim() ? ` — ${c.description.trim()}` : "";
      lines.push(`- ${c.name.trim() || "—"} (${c.id})${desc}`);
    }
  }

  lines.push(
    "",
    "## Look",
    `Background plate color hint: ${plate.color?.trim() || "#0a0a0a"}.`,
    textStyleHints.length
      ? `Typography / caption vibe (for mood only — do not render text): ${textStyleHints.join("; ")}`
      : "",
    plate.src?.trim()
      ? "A plate image may be set for this scene — respect its general environment tone if it does not conflict with the style contract."
      : "",
  );

  const body = lines.filter((x) => x !== "").join("\n");
  return truncateTailWithNote(body, OPENAI_IMAGE_PROMPT_MAX_CHARS);
}
