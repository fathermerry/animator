export type CostItem = {
  label: string;
  amount: number;
};

export type Cost = {
  amount: number;
  currency: string;
  breakdown: CostItem[];
};

/** Billable / trackable generation targets shown in cost activity. */
export type RenderTargetType = "frame" | "asset" | "reference" | "narration" | "script" | "storyboard";

/** When {@link Render.type} is `asset`, which kit row this render produced. */
export type RenderKitTarget =
  | { kind: "characters"; assetId: string }
  /** Legacy renders from older projects; no longer produced. */
  | { kind: "objects"; assetId: string };

/**
 * What was generated for cost/history. Distinct from {@link Render.type} (workflow: frame, narration, script, etc.).
 */
export type RenderTargetMedia = "image" | "audio" | "text";

/**
 * What a billable run produced — saved on the model for cost/exports.
 * `type` is the output modality (image vs audio). Text (script/story plan) uses `"text"`.
 * {@link Render.model} is duplicated at the top level for the active engine; `target.model` is the same for portable rows.
 */
export type RenderTargetPersisted = {
  type: RenderTargetMedia;
  name: string;
  /** Frame id, scene id, asset id, project id, etc. */
  referenceId?: string;
  /** e.g. `openai`, `remotion`, `three` */
  provider: string;
  model?: string;
};

export type Render = {
  id: string;
  projectId: string;
  sceneId: string;
  type: RenderTargetType;
  engine: "remotion" | "three" | "openai-image" | "openai-audio" | "openai-text";
  status: "pending" | "processing" | "complete" | "failed";
  cost: Cost;
  createdAt: Date;
  target: RenderTargetPersisted;
  /** When this render entered `processing` (work started). */
  startedAt?: Date;
  /** When this render finished (`complete` or `failed`). */
  endedAt?: Date;
  /** Set when {@link engine} is `openai-image` (which image model produced the still). */
  model?: string;
  /** Present for style-kit asset image generations. */
  kitTarget?: RenderKitTarget;
};

export type Frame = {
  id: string;
  projectId: string;
  sceneId: string;
  renderId: string;
  index: number;
  src: string;
  /** How this frame is produced: LLM image generation, or native Remotion graphics. */
  productionType?: "llm" | "remotion-shapes";
  /** Staging copy for this still — shown under the scene title in the film and UI. */
  description: string;
  /** Optional explicit hold length for this frame. Remaining scene time is split between frames without this. */
  durationSeconds?: number;
  /** Transition frames bridge beats rather than acting as primary keyframes. */
  kind?: "keyframe" | "transition";
};

export type Scene = {
  id: string;
  projectId: string;
  index: number;
  /** Short label for lists and chrome (e.g. Story scene row). */
  title: string;
  /** Staging / beat copy: who does what with props. */
  description: string;
  /** Spoken lines for this scene (chunk of the project script / VO). Distinct from staging `description`. */
  voiceoverText: string;
  /** Optional URL to generated narration audio (e.g. `/renders/{projectId}/narration-{sceneId}.mp3`). */
  narrationAudioSrc?: string;
  characterIds: string[];
  /** Optional plate color; falls back to the style kit background. */
  backgroundColor?: string;
  /** Optional plate image; falls back to the style kit background image. */
  backgroundImageSrc?: string;
  durationSeconds: number;
  /** Optional pause before the scene starts. */
  delaySeconds?: number;
  /** Optional transition into this scene. */
  transition?: "cut" | "fade" | "dissolve";
  transitionSeconds?: number;
  createdAt: Date;
};

export type Project = {
  id: string;
  name: string;
  /** When set, shown in the header (and tab title) as the file name, e.g. `default-project.json`. */
  fileLabel?: string;
  createdAt: Date;

  prompt: string;
  /** Confirmed/editable script generated from the raw story prompt. */
  script?: string;
  styleConfigId: string;
};
