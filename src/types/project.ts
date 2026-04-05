export type CostItem = {
  label: string;
  amount: number;
};

export type Cost = {
  amount: number;
  currency: string;
  breakdown: CostItem[];
};

export type Render = {
  id: string;
  projectId: string;
  sceneId: string;
  engine: "remotion" | "three";
  status: "pending" | "processing" | "complete" | "failed";
  cost: Cost;
  createdAt: Date;
};

export type Frame = {
  id: string;
  projectId: string;
  sceneId: string;
  renderId: string;
  index: number;
  src: string;
};

export type Scene = {
  id: string;
  projectId: string;
  index: number;
  /** Short label for lists and chrome (e.g. Story scene row). */
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
