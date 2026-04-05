import { createStore } from "zustand/vanilla";

import defaultProjectJson from "../data/default-project.json";
import defaultStyleConfigJson from "../data/default-style-config.json";
import { projectFromConfigJson } from "../lib/projectHydrate";
import type { Frame, Project, Render, Scene } from "../types/project";
import { createDefaultStyle, type Style, type StyleConfig } from "../types/styleConfig";

export type ProjectState = {
  project: Project;
  styleConfigs: StyleConfig[];
  scenes: Scene[];
  renders: Render[];
  frames: Frame[];

  ensureDraftProject: () => string;
  setPromptText: (text: string) => void;
  updateStyle: (recipe: (style: Style) => Style) => void;
  patchScene: (sceneId: string, patch: Partial<Scene>) => void;
  loadDefaultProject: () => void;
};

const bundledStyle = defaultStyleConfigJson as StyleConfig;
const initialBundle = projectFromConfigJson(defaultProjectJson, [bundledStyle]);

function initialState(): Omit<
  ProjectState,
  "ensureDraftProject" | "setPromptText" | "updateStyle" | "patchScene" | "loadDefaultProject"
> {
  return {
    project: initialBundle.project,
    styleConfigs: initialBundle.styleConfigs,
    scenes: initialBundle.scenes,
    renders: initialBundle.renders,
    frames: initialBundle.frames,
  };
}

export const useProjectStore = createStore<ProjectState>((set, get) => ({
  ...initialState(),

  ensureDraftProject: () => get().project.id,

  loadDefaultProject: () => {
    const prev = get().project;
    const fresh = projectFromConfigJson(defaultProjectJson, [bundledStyle]);
    const projectId = prev.id;
    set({
      project: {
        ...fresh.project,
        id: projectId,
        createdAt: prev.createdAt,
      },
      styleConfigs: fresh.styleConfigs,
      scenes: fresh.scenes.map((sc) => ({ ...sc, projectId })),
      renders: fresh.renders.map((r) => ({ ...r, projectId })),
      frames: fresh.frames.map((f) => ({ ...f, projectId })),
    });
  },

  setPromptText: (text) => {
    set((s) => ({
      project: {
        ...s.project,
        prompt: text,
      },
    }));
  },

  updateStyle: (recipe) => {
    set((s) => {
      const id = s.project.styleConfigId;
      const styleConfigs = s.styleConfigs.map((c) =>
        c.id === id ? { ...c, style: recipe(c.style) } : c,
      );
      return { styleConfigs };
    });
  },

  patchScene: (sceneId, patch) => {
    set((s) => ({
      scenes: s.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...patch } : sc)),
    }));
  },
}));

export function selectCurrentProject(s: ProjectState): Project {
  return s.project;
}

export function selectResolvedStyle(s: ProjectState): Style {
  const c = s.styleConfigs.find((x) => x.id === s.project.styleConfigId);
  return c?.style ?? createDefaultStyle();
}

export function selectScenes(s: ProjectState): Scene[] {
  return s.scenes;
}
