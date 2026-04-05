import { createStore } from "zustand/vanilla";

import defaultProjectJson from "../data/default-project.json";
import defaultAssetsConfigJson from "../data/default-assets-config.json";
import { buildFrameImagePrompt } from "../lib/buildFrameImagePrompt";
import { frameHasOutputImage } from "../lib/frameRenderStatus";
import {
  DEFAULT_OPENAI_IMAGE_MODEL,
  type OpenAiImageModelId,
  isOpenAiImageModelId,
} from "../lib/imageModels";
import {
  deleteProjectRecord,
  getProjectSlice,
  putProjectSlice,
  setActiveProjectId,
} from "../lib/projectIndexedDb";
import type { PersistableProjectSlice } from "../lib/projectPersistence";
import { projectFromConfigJson } from "../lib/projectHydrate";
import { requestFrameImageRender } from "../lib/renderFrameApi";
import { navigate } from "../router";
import { SAMPLE_PROJECT_ID } from "../lib/sampleProject";
import type { Frame, Project, Render, Scene } from "../types/project";
import { createDefaultAssetBundle, type AssetBundle, type AssetsConfig } from "../types/assetsConfig";

const frameRenderAbortControllers = new Map<string, AbortController>();

function abortAllFrameRenders(): void {
  for (const id of [...frameRenderAbortControllers.keys()]) {
    frameRenderAbortControllers.get(id)?.abort();
    frameRenderAbortControllers.delete(id);
  }
}

function takeSignalForFrame(frameId: string): AbortSignal {
  frameRenderAbortControllers.get(frameId)?.abort();
  const ac = new AbortController();
  frameRenderAbortControllers.set(frameId, ac);
  return ac.signal;
}

function releaseFrameAbort(frameId: string): void {
  frameRenderAbortControllers.delete(frameId);
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === "AbortError") ||
    (e instanceof Error && e.name === "AbortError")
  );
}

export type ProjectState = {
  project: Project;
  assetsConfigs: AssetsConfig[];
  scenes: Scene[];
  renders: Render[];
  frames: Frame[];
  /** Ephemeral UI: frames currently in a render pass. */
  renderingFrameIds: Record<string, true>;
  /** Last error message per frame from the image API (not persisted). */
  frameRenderErrors: Record<string, string>;

  ensureDraftProject: () => string;
  setPromptText: (text: string) => void;
  updateAssets: (recipe: (bundle: AssetBundle) => AssetBundle) => void;
  patchScene: (sceneId: string, patch: Partial<Scene>) => void;
  patchFrame: (frameId: string, patch: Partial<Frame>) => void;
  patchRender: (renderId: string, patch: Partial<Render>) => void;
  clearFrameRenderError: (frameId: string) => void;
  loadDefaultProject: () => void;
  removeFrame: (frameId: string) => void;
  requestFrameRender: (frameId: string, modelId?: OpenAiImageModelId) => Promise<void>;
  requestFullFilmRender: (modelId?: OpenAiImageModelId) => Promise<void>;
  cancelFrameRender: (frameId: string) => void;

  openProject: (id: string) => Promise<void>;
  createNewProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
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
  | "patchRender"
  | "clearFrameRenderError"
  | "loadDefaultProject"
  | "removeFrame"
  | "requestFrameRender"
  | "requestFullFilmRender"
  | "cancelFrameRender"
  | "openProject"
  | "createNewProject"
  | "deleteProject"
> {
  return {
    project: initialBundle.project,
    assetsConfigs: initialBundle.assetsConfigs,
    scenes: initialBundle.scenes,
    renders: initialBundle.renders,
    frames: initialBundle.frames,
    renderingFrameIds: {},
    frameRenderErrors: {},
  };
}

export const useProjectStore = createStore<ProjectState>((set, get) => {
  const runFrameImageRender = async (
    frameId: string,
    options: { clearRenderingFlagWhenDone: boolean },
    modelId: OpenAiImageModelId,
  ): Promise<void> => {
    const frame = get().frames.find((f) => f.id === frameId);
    if (!frame) return;
    const scene = get().scenes.find((sc) => sc.id === frame.sceneId);
    const render = get().renders.find((r) => r.id === frame.renderId);
    if (!scene || !render) return;

    const signal = takeSignalForFrame(frameId);

    set((st) => {
      const frameRenderErrors = { ...st.frameRenderErrors };
      delete frameRenderErrors[frameId];
      return {
        renderingFrameIds: { ...st.renderingFrameIds, [frameId]: true },
        frameRenderErrors,
      };
    });

    const bundle = selectResolvedAssetBundle(get());
    const prompt = buildFrameImagePrompt(get().project, scene, frame, bundle);

    get().patchRender(render.id, { status: "processing", engine: "openai-image" });

    try {
      const data = await requestFrameImageRender(
        {
          projectId: get().project.id,
          frameId: frame.id,
          prompt,
          modelId,
        },
        signal,
      );
      get().patchFrame(frameId, { src: data.imageUrl });
      get().patchRender(render.id, {
        status: "complete",
        engine: "openai-image",
        model: data.model,
        cost: data.cost,
      });
    } catch (e: unknown) {
      if (isAbortError(e)) {
        get().patchRender(render.id, { status: "pending" });
        return;
      }
      const msg = e instanceof Error ? e.message : "Render failed";
      set((st) => ({
        frameRenderErrors: { ...st.frameRenderErrors, [frameId]: msg },
      }));
      get().patchRender(render.id, { status: "failed" });
    } finally {
      releaseFrameAbort(frameId);
      if (options.clearRenderingFlagWhenDone) {
        set((st) => {
          const renderingFrameIds = { ...st.renderingFrameIds };
          delete renderingFrameIds[frameId];
          return { renderingFrameIds };
        });
      }
    }
  };

  return {
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
        renderingFrameIds: {},
        frameRenderErrors: {},
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

    patchRender: (renderId, patch) => {
      set((s) => ({
        renders: s.renders.map((r) => (r.id === renderId ? { ...r, ...patch } : r)),
      }));
    },

    clearFrameRenderError: (frameId) => {
      set((s) => {
        const frameRenderErrors = { ...s.frameRenderErrors };
        delete frameRenderErrors[frameId];
        return { frameRenderErrors };
      });
    },

    removeFrame: (frameId) => {
      frameRenderAbortControllers.get(frameId)?.abort();
      frameRenderAbortControllers.delete(frameId);
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

        const renderingFrameIds = { ...s.renderingFrameIds };
        delete renderingFrameIds[frameId];
        const frameRenderErrors = { ...s.frameRenderErrors };
        delete frameRenderErrors[frameId];
        return { frames, renders, renderingFrameIds, frameRenderErrors };
      });
    },

    requestFrameRender: async (frameId, modelIdParam) => {
      const modelId: OpenAiImageModelId =
        modelIdParam && isOpenAiImageModelId(modelIdParam) ? modelIdParam : DEFAULT_OPENAI_IMAGE_MODEL;
      await runFrameImageRender(frameId, { clearRenderingFlagWhenDone: true }, modelId);
    },

    requestFullFilmRender: async (modelIdParam) => {
      const modelId: OpenAiImageModelId =
        modelIdParam && isOpenAiImageModelId(modelIdParam) ? modelIdParam : DEFAULT_OPENAI_IMAGE_MODEL;
      const targets = get().frames.filter((f) => !frameHasOutputImage(f.src));
      if (targets.length === 0) return;

      set((st) => {
        const renderingFrameIds = { ...st.renderingFrameIds };
        const frameRenderErrors = { ...st.frameRenderErrors };
        for (const f of targets) {
          renderingFrameIds[f.id] = true;
          delete frameRenderErrors[f.id];
        }
        return { renderingFrameIds, frameRenderErrors };
      });

      for (const f of targets) {
        await runFrameImageRender(f.id, { clearRenderingFlagWhenDone: false }, modelId);
      }

      set((st) => {
        const renderingFrameIds = { ...st.renderingFrameIds };
        for (const f of targets) delete renderingFrameIds[f.id];
        return { renderingFrameIds };
      });
    },

    cancelFrameRender: (frameId) => {
      frameRenderAbortControllers.get(frameId)?.abort();
      set((s) => {
        const renderingFrameIds = { ...s.renderingFrameIds };
        delete renderingFrameIds[frameId];
        return { renderingFrameIds };
      });
      const fr = get().frames.find((f) => f.id === frameId);
      const r = fr ? get().renders.find((x) => x.id === fr.renderId) : undefined;
      if (r?.status === "processing") {
        get().patchRender(fr!.renderId, { status: "pending" });
      }
    },

    openProject: async (id) => {
      const slice = await getProjectSlice(id);
      if (!slice) return;
      abortAllFrameRenders();
      await setActiveProjectId(id);
      set({
        project: slice.project,
        assetsConfigs: slice.assetsConfigs,
        scenes: slice.scenes,
        renders: slice.renders,
        frames: slice.frames,
        renderingFrameIds: {},
        frameRenderErrors: {},
      });
      navigate("/script");
    },

    createNewProject: async () => {
      abortAllFrameRenders();
      const bundle = projectFromConfigJson({}, [bundledAssets]);
      const slice: PersistableProjectSlice = {
        project: bundle.project,
        assetsConfigs: bundle.assetsConfigs,
        scenes: bundle.scenes,
        renders: bundle.renders,
        frames: bundle.frames,
      };
      await putProjectSlice(slice);
      await setActiveProjectId(slice.project.id);
      set({
        project: slice.project,
        assetsConfigs: slice.assetsConfigs,
        scenes: slice.scenes,
        renders: slice.renders,
        frames: slice.frames,
        renderingFrameIds: {},
        frameRenderErrors: {},
      });
      navigate("/script");
    },

    deleteProject: async (id) => {
      if (id === SAMPLE_PROJECT_ID) return;
      await deleteProjectRecord(id);
      if (get().project.id !== id) return;
      abortAllFrameRenders();
      const sample = await getProjectSlice(SAMPLE_PROJECT_ID);
      if (!sample) return;
      await setActiveProjectId(SAMPLE_PROJECT_ID);
      set({
        project: sample.project,
        assetsConfigs: sample.assetsConfigs,
        scenes: sample.scenes,
        renders: sample.renders,
        frames: sample.frames,
        renderingFrameIds: {},
        frameRenderErrors: {},
      });
    },
  };
});

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
