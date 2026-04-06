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
export type RenderKitTarget = {
  kind: "characters" | "objects";
  assetId: string;
};

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
  /** Short label for lists and chrome (e.g. Script scene row). */
  title: string;
  /** Staging / beat copy: who does what with props. */
  description: string;
  characterIds: string[];
  objectIds: string[];
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
