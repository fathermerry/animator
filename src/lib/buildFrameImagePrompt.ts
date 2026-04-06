import type { Frame, Project, Scene } from "@/types/project";
import type { AssetBundle, KitAsset } from "@/types/styleConfig";

/** OpenAI Images API (`images.generate`) rejects prompts over this length. */
export const OPENAI_IMAGE_PROMPT_MAX_CHARS = 4000;

export function truncateTailWithNote(s: string, max: number): string {
  if (s.length <= max) return s;
  const note = "\n[Truncated]";
  return s.slice(0, Math.max(0, max - note.length)) + note;
}

export type FrameImageContext = {
  sceneTitle: string;
  sceneDescription: string;
  frameDescription: string;
  characters: { id: string; name: string; description?: string }[];
  /** True when the scene has a reference still set on the Style step (image not embedded in prompt). */
  hasSceneReferenceImage: boolean;
  backgroundColor: string;
  textStyleHints: string[];
  /** Overall style direction from the Style step. */
  styleDescription: string;
  kitNotes: string;
};

function resolveKitAssets(ids: string[], pool: KitAsset[]): KitAsset[] {
  const out: KitAsset[] = [];
  for (const id of ids) {
    const a = pool.find((x) => x.id === id);
    if (a) out.push(a);
  }
  return out;
}

/** Structured context for one film still (scene + frame + style kit). */
export function buildFrameImageContext(scene: Scene, frame: Frame, bundle: AssetBundle): FrameImageContext {
  const chars = resolveKitAssets(scene.characterIds, bundle.characters);
  const ref = scene.referenceImageSrc?.trim() ?? "";
  return {
    sceneTitle: scene.title.trim(),
    sceneDescription: scene.description.trim(),
    frameDescription: frame.description.trim(),
    characters: chars.map((c) => ({
      id: c.id,
      name: c.name.trim(),
      ...(c.description?.trim() ? { description: c.description.trim() } : {}),
    })),
    hasSceneReferenceImage: ref.length > 0,
    backgroundColor: bundle.background.color?.trim() || "#0a0a0a",
    textStyleHints: bundle.textStyles.map((t) => t.instructions.trim()).filter(Boolean),
    styleDescription: bundle.description.trim(),
    kitNotes: bundle.notes.trim(),
  };
}

function styleContractSection(ctx: FrameImageContext): string[] {
  const lines: string[] = [
    "## Style contract (binding)",
    "Must match this visual language for the entire image — environment, characters, and props.",
  ];
  if (ctx.styleDescription) {
    lines.push(ctx.styleDescription);
  } else {
    lines.push(
      "Use illustrated / explainer graphics consistent with the style kit — do not default to photoreal stock photography, glossy ad stills, or cinematic live-action B-roll unless the scene beat explicitly requires it.",
    );
  }
  if (ctx.kitNotes) {
    lines.push(`Additional kit constraints: ${ctx.kitNotes}`);
  }
  if (ctx.styleDescription || ctx.kitNotes) {
    lines.push(
      "Avoid unrelated photoreal stock imagery; cast and props must read as the same graphic language as the channel style kit.",
    );
  }
  return lines;
}

/**
 * Single prompt for an image model: staging, cast/props, and kit constraints.
 * Kept deterministic and sectioned so swapping models does not require UI changes.
 */
export function frameImagePromptFromContext(ctx: FrameImageContext): string {
  const lines: string[] = [
    "Generate a single high-quality widescreen (16:9) keyframe image for a finance YouTube video.",
    "No text overlays, watermarks, or logos unless described as part of the scene.",
    "",
    ...styleContractSection(ctx),
    "",
    "## Scene",
    ctx.sceneTitle ? `Title: ${ctx.sceneTitle}` : "Title: (untitled scene)",
    ctx.sceneDescription ? `Beat / action: ${ctx.sceneDescription}` : "",
    "",
    "## This frame",
    ctx.frameDescription
      ? `Staging / shot: ${ctx.frameDescription}`
      : "Staging / shot: Match the scene beat with a clear focal subject.",
    "",
    "## Cast (in shot)",
    "Render each person below in the same graphic language as the style kit — not as unrelated live-action actors or stock models.",
  ];

  if (ctx.characters.length === 0) {
    lines.push("(No characters selected — use environment and props only.)");
  } else {
    for (const c of ctx.characters) {
      const desc = c.description ? ` — ${c.description}` : "";
      lines.push(`- ${c.name} (${c.id})${desc}`);
    }
  }

  lines.push(
    "",
    "## Scene reference (visual target)",
    ctx.hasSceneReferenceImage
      ? "This scene has a reference still on the Style step — match its composition energy, palette, line weight, and illustration language for every generated frame in this scene. Treat it as the authoritative look target for this beat (do not ignore it in favor of unrelated stock or live-action styles)."
      : "(No scene reference image set on the Style step — rely on the style contract and cast descriptions above.)",
  );

  lines.push(
    "",
    "## Look",
    `Background plate color hint: ${ctx.backgroundColor}.`,
    ctx.textStyleHints.length
      ? `Typography / caption vibe (for mood only — do not render text): ${ctx.textStyleHints.join("; ")}`
      : "",
  );

  return lines.filter((x) => x !== "").join("\n");
}

/**
 * Builds the image prompt, keeping the scene/frame/kit `body` intact when possible and
 * trimming the overall script brief first so long projects stay under the API cap.
 */
export function buildFrameImagePrompt(project: Project, scene: Scene, frame: Frame, bundle: AssetBundle): string {
  const body = frameImagePromptFromContext(buildFrameImageContext(scene, frame, bundle));
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
