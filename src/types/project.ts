export type CostItem = {
  label: string;
  amount: number;
};

export type Cost = {
  amount: number;
  currency: string;
  breakdown: CostItem[];
};

/** Film frame still vs style-kit character/object still. */
export type RenderTargetType = "frame" | "asset";

/** When {@link Render.type} is `asset`, which kit row this render produced. */
export type RenderKitTarget =
  | { kind: "characters"; assetId: string }
  /** Legacy renders from older projects; no longer produced. */
  | { kind: "objects"; assetId: string };

export type Render = {
  id: string;
  projectId: string;
  sceneId: string;
  type: RenderTargetType;
  engine: "remotion" | "three" | "openai-image";
  status: "pending" | "processing" | "complete" | "failed";
  cost: Cost;
  createdAt: Date;
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
  /** Staging copy for this still — shown under the scene title in the film and UI. */
  description: string;
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
  /** One optional still defining target look for this scene’s frames (Style step). */
  referenceImageSrc?: string;
  /** Optional plate color; falls back to the style kit background. */
  backgroundColor?: string;
  /** Optional plate image; falls back to the style kit background image. */
  backgroundImageSrc?: string;
  durationSeconds: number;
  createdAt: Date;
};

export type Project = {
  id: string;
  name: string;
  /** When set, shown in the header (and tab title) as the file name, e.g. `default-project.json`. */
  fileLabel?: string;
  createdAt: Date;

  prompt: string;
  styleConfigId: string;
};
