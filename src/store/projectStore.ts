import { createStore } from "zustand/vanilla";

import defaultProjectJson from "../data/default-project.json";
import defaultAssetsConfigJson from "../data/default-assets-config.json";
import { projectFromConfigJson } from "../lib/projectHydrate";
import type { Frame, Project, Render, Scene } from "../types/project";
import { createDefaultAssetBundle, type AssetBundle, type AssetsConfig } from "../types/assetsConfig";

export type ProjectState = {
  project: Project;
  assetsConfigs: AssetsConfig[];
  scenes: Scene[];
  renders: Render[];
  frames: Frame[];

  ensureDraftProject: () => string;
  setPromptText: (text: string) => void;
  updateAssets: (recipe: (bundle: AssetBundle) => AssetBundle) => void;
  patchScene: (sceneId: string, patch: Partial<Scene>) => void;
  patchFrame: (frameId: string, patch: Partial<Frame>) => void;
  loadDefaultProject: () => void;
  removeFrame: (frameId: string) => void;
};

const bundledAssets = defaultAssetsConfigJson as AssetsConfig;
const initialBundle = projectFromConfigJson(defaultProjectJson, [bundledAssets]);

function initialState(): Omit<
  ProjectState,
  | "ensureDraftProject"
  | "setPromptText"
  | "updateAssets"
  | "patchScene"
  | "patchFrame"
  | "loadDefaultProject"
  | "removeFrame"
> {
  return {
    project: initialBundle.project,
    assetsConfigs: initialBundle.assetsConfigs,
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
    const fresh = projectFromConfigJson(defaultProjectJson, [bundledAssets]);
    const projectId = prev.id;
    set({
      project: {
        ...fresh.project,
        id: projectId,
        createdAt: prev.createdAt,
      },
      assetsConfigs: fresh.assetsConfigs,
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

  updateAssets: (recipe) => {
    set((s) => {
      const id = s.project.assetsConfigId;
      const assetsConfigs = s.assetsConfigs.map((c) =>
        c.id === id ? { ...c, assets: recipe(c.assets) } : c,
      );
      return { assetsConfigs };
    });
  },

  patchScene: (sceneId, patch) => {
    set((s) => ({
      scenes: s.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...patch } : sc)),
    }));
  },

  patchFrame: (frameId, patch) => {
    set((s) => ({
      frames: s.frames.map((f) => (f.id === frameId ? { ...f, ...patch } : f)),
    }));
  },

  removeFrame: (frameId) => {
    set((s) => {
      const removed = s.frames.find((f) => f.id === frameId);
      if (!removed) return s;
      const sceneId = removed.sceneId;
      const renderId = removed.renderId;

      const framesWithout = s.frames.filter((f) => f.id !== frameId);
      const inScene = framesWithout
        .filter((f) => f.sceneId === sceneId)
        .sort((a, b) => a.index - b.index);

      const frames = framesWithout.map((f) => {
        if (f.sceneId !== sceneId) return f;
        const idx = inScene.findIndex((x) => x.id === f.id);
        return idx >= 0 ? { ...f, index: idx } : f;
      });

      let renders = s.renders;
      if (!frames.some((f) => f.renderId === renderId)) {
        renders = renders.filter((r) => r.id !== renderId);
      }

      return { frames, renders };
    });
  },
}));

export function selectCurrentProject(s: ProjectState): Project {
  return s.project;
}

export function selectResolvedAssetBundle(s: ProjectState): AssetBundle {
  const c = s.assetsConfigs.find((x) => x.id === s.project.assetsConfigId);
  return c?.assets ?? createDefaultAssetBundle();
}

export function selectScenes(s: ProjectState): Scene[] {
  return s.scenes;
}
