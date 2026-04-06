import { createStore } from "zustand/vanilla";

import defaultProjectJson from "../data/default-project.json";
import { buildFrameImagePrompt } from "../lib/buildFrameImagePrompt";
import {
  buildKitAssetImagePrompt,
  KIT_ASSET_RENDER_IMAGE_SIZE,
  kitAssetRenderFrameId,
  type KitAssetKind,
} from "../lib/buildKitAssetImagePrompt";
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
import { navigate, pathForProjectStep } from "../router";
import { SAMPLE_PROJECT_ID } from "../lib/sampleProject";
import type { Frame, Project, Render, Scene } from "../types/project";
import {
  createDefaultAssetBundle,
  type AssetBundle,
  type KitAsset,
  type StyleConfig,
} from "../types/styleConfig";

/**
 * Stable object when no {@link ProjectState.styleConfigs} entry matches {@link Project.styleConfigId}.
 * `createDefaultAssetBundle()` must not be called per selector invocation — React 19's
 * `useSyncExternalStore` (used by zustand) requires referentially stable snapshots when state is unchanged.
 */
const FALLBACK_RESOLVED_STYLE_BUNDLE = createDefaultAssetBundle();

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

/** Store key for {@link ProjectState.kitAssetGeneratingKeys} (parallel kit generation UI). */
export function kitAssetGeneratingKey(kind: KitAssetKind, assetId: string): string {
  return `${kind}:${assetId}`;
}

export type ProjectState = {
  project: Project;
  styleConfigs: StyleConfig[];
  scenes: Scene[];
  renders: Render[];
  frames: Frame[];
  /** Ephemeral UI: frames currently in a render pass. */
  renderingFrameIds: Record<string, true>;
  /** Last error message per frame from the image API (not persisted). */
  frameRenderErrors: Record<string, string>;
  /** Ephemeral UI: style-kit batch generation in progress. */
  generatingKitAssets: boolean;
  /** Ephemeral UI: which kit rows are currently generating (key = {@link kitAssetGeneratingKey}). */
  kitAssetGeneratingKeys: Record<string, true>;
  /** Last error per kit-asset render id from the image API (not persisted). */
  kitAssetRenderErrors: Record<string, string>;

  ensureDraftProject: () => string;
  setPromptText: (text: string) => void;
  updateStyle: (recipe: (bundle: AssetBundle) => AssetBundle) => void;
  patchScene: (sceneId: string, patch: Partial<Scene>) => void;
  patchFrame: (frameId: string, patch: Partial<Frame>) => void;
  patchRender: (renderId: string, patch: Partial<Render>) => void;
  clearFrameRenderError: (frameId: string) => void;
  loadDefaultProject: () => void;
  /** Restore bundled seed for the sample project, clear its `public/renders` folder via API, persist to IDB. */
  resetSampleProject: () => Promise<void>;
  removeFrame: (frameId: string) => void;
  requestFrameRender: (frameId: string, modelId?: OpenAiImageModelId) => Promise<void>;
  requestFullFilmRender: (modelId?: OpenAiImageModelId) => Promise<void>;
  requestKitAssetsRender: (modelId?: OpenAiImageModelId) => Promise<void>;
  /** Generate one style-kit still (character or object) via the image API. */
  requestKitAssetRender: (
    kind: KitAssetKind,
    assetId: string,
    modelId?: OpenAiImageModelId,
  ) => Promise<void>;
  cancelFrameRender: (frameId: string) => void;

  openProject: (id: string) => Promise<void>;
  /** Load a project from storage to match the URL; does not change the hash. */
  loadProjectById: (id: string) => Promise<boolean>;
  createNewProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
};

const initialBundle = projectFromConfigJson(defaultProjectJson);

function initialState(): Omit<
  ProjectState,
  | "ensureDraftProject"
  | "setPromptText"
  | "updateStyle"
  | "patchScene"
  | "patchFrame"
  | "patchRender"
  | "clearFrameRenderError"
  | "loadDefaultProject"
  | "resetSampleProject"
  | "removeFrame"
  | "requestFrameRender"
  | "requestFullFilmRender"
  | "requestKitAssetsRender"
  | "requestKitAssetRender"
  | "cancelFrameRender"
  | "openProject"
  | "loadProjectById"
  | "createNewProject"
  | "deleteProject"
> {
  return {
    project: initialBundle.project,
    styleConfigs: initialBundle.styleConfigs,
    scenes: initialBundle.scenes,
    renders: initialBundle.renders,
    frames: initialBundle.frames,
    renderingFrameIds: {},
    frameRenderErrors: {},
    generatingKitAssets: false,
    kitAssetGeneratingKeys: {},
    kitAssetRenderErrors: {},
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
    const render = get().renders.find((r) => r.id === frame.renderId && r.type === "frame");
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

    const bundle = selectResolvedStyleBundle(get());
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
      get().patchFrame(frameId, { src: data.imageDataUrl ?? data.imageUrl });
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

  const runKitAssetImageRender = async (
    kind: KitAssetKind,
    asset: KitAsset,
    modelId: OpenAiImageModelId,
  ): Promise<void> => {
    const project = get().project;
    const bundle = selectResolvedStyleBundle(get());
    const prompt = buildKitAssetImagePrompt(project, bundle, kind, asset);
    const frameId = kitAssetRenderFrameId(kind, asset.id);
    const renderId = crypto.randomUUID();
    const zeroCost: Render["cost"] = { amount: 0, currency: "USD", breakdown: [] };
    const newRender: Render = {
      id: renderId,
      projectId: project.id,
      sceneId: "",
      type: "asset",
      engine: "openai-image",
      status: "processing",
      cost: zeroCost,
      createdAt: new Date(),
      kitTarget: { kind, assetId: asset.id },
    };
    set((s) => ({ renders: [...s.renders, newRender] }));

    try {
      const data = await requestFrameImageRender({
        projectId: project.id,
        frameId,
        prompt,
        modelId,
      });
      get().updateStyle((b) => {
        const list = b[kind];
        const idx = list.findIndex((a) => a.id === asset.id);
        if (idx === -1) return b;
        const prev = list[idx]!;
        const next = [...list];
        const src = data.imageDataUrl ?? data.imageUrl;
        if (kind === "objects") {
          next[idx] = {
            id: prev.id,
            name: prev.name,
            src,
            width: KIT_ASSET_RENDER_IMAGE_SIZE,
            height: KIT_ASSET_RENDER_IMAGE_SIZE,
          };
        } else {
          next[idx] = {
            ...prev,
            src,
            width: KIT_ASSET_RENDER_IMAGE_SIZE,
            height: KIT_ASSET_RENDER_IMAGE_SIZE,
          };
        }
        return { ...b, [kind]: next };
      });
      get().patchRender(renderId, {
        status: "complete",
        engine: "openai-image",
        model: data.model,
        cost: data.cost,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Render failed";
      set((st) => ({
        kitAssetRenderErrors: { ...st.kitAssetRenderErrors, [renderId]: msg },
      }));
      get().patchRender(renderId, { status: "failed" });
    } finally {
      const gk = kitAssetGeneratingKey(kind, asset.id);
      set((st) => {
        const kitAssetGeneratingKeys = { ...st.kitAssetGeneratingKeys };
        delete kitAssetGeneratingKeys[gk];
        return { kitAssetGeneratingKeys };
      });
    }
  };

  return {
    ...initialState(),

    ensureDraftProject: () => get().project.id,

    loadDefaultProject: () => {
      const prev = get().project;
      const fresh = projectFromConfigJson(defaultProjectJson);
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
        renderingFrameIds: {},
        frameRenderErrors: {},
        generatingKitAssets: false,
        kitAssetGeneratingKeys: {},
        kitAssetRenderErrors: {},
      });
    },

    resetSampleProject: async () => {
      if (get().project.id !== SAMPLE_PROJECT_ID) return;
      try {
        const res = await fetch(
          `/api/project-renders/${encodeURIComponent(SAMPLE_PROJECT_ID)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          console.warn("resetSampleProject: failed to clear renders folder", res.status);
        }
      } catch (e: unknown) {
        console.warn("resetSampleProject: render API unreachable", e);
      }
      abortAllFrameRenders();
      const prev = get().project;
      const fresh = projectFromConfigJson(defaultProjectJson);
      const projectId = SAMPLE_PROJECT_ID;
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
        renderingFrameIds: {},
        frameRenderErrors: {},
        generatingKitAssets: false,
        kitAssetGeneratingKeys: {},
        kitAssetRenderErrors: {},
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
        let idx = s.styleConfigs.findIndex((c) => c.id === s.project.styleConfigId);
        if (idx < 0 && s.styleConfigs.length > 0) idx = 0;
        if (idx < 0) return s;
        const target = s.styleConfigs[idx]!;
        const styleConfigs = s.styleConfigs.map((c, i) =>
          i === idx ? { ...c, assets: recipe(c.assets) } : c,
        );
        const project =
          s.project.styleConfigId === target.id
            ? s.project
            : { ...s.project, styleConfigId: target.id };
        return { styleConfigs, project };
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

    requestKitAssetsRender: async (modelIdParam) => {
      if (get().generatingKitAssets) return;
      const modelId: OpenAiImageModelId =
        modelIdParam && isOpenAiImageModelId(modelIdParam) ? modelIdParam : DEFAULT_OPENAI_IMAGE_MODEL;
      const bundle = selectResolvedStyleBundle(get());
      const n = bundle.characters.length + bundle.objects.length;
      if (n === 0) return;

      const initialKeys: Record<string, true> = {};
      for (const a of bundle.characters) {
        initialKeys[kitAssetGeneratingKey("characters", a.id)] = true;
      }
      for (const a of bundle.objects) {
        initialKeys[kitAssetGeneratingKey("objects", a.id)] = true;
      }

      set({
        generatingKitAssets: true,
        kitAssetGeneratingKeys: initialKeys,
        kitAssetRenderErrors: {},
      });
      try {
        await Promise.all([
          ...bundle.characters.map((asset) => runKitAssetImageRender("characters", asset, modelId)),
          ...bundle.objects.map((asset) => runKitAssetImageRender("objects", asset, modelId)),
        ]);
      } finally {
        set({ generatingKitAssets: false, kitAssetGeneratingKeys: {} });
      }
    },

    requestKitAssetRender: async (kind, assetId, modelIdParam) => {
      const gk = kitAssetGeneratingKey(kind, assetId);
      if (get().kitAssetGeneratingKeys[gk]) return;
      const bundle = selectResolvedStyleBundle(get());
      const list = bundle[kind];
      const asset = list.find((a) => a.id === assetId);
      if (!asset) return;
      const modelId: OpenAiImageModelId =
        modelIdParam && isOpenAiImageModelId(modelIdParam) ? modelIdParam : DEFAULT_OPENAI_IMAGE_MODEL;
      set((st) => ({
        kitAssetGeneratingKeys: { ...st.kitAssetGeneratingKeys, [gk]: true },
      }));
      await runKitAssetImageRender(kind, asset, modelId);
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
      const r = fr ? get().renders.find((x) => x.id === fr.renderId && x.type === "frame") : undefined;
      if (r?.status === "processing") {
        get().patchRender(fr!.renderId, { status: "pending" });
      }
    },

    loadProjectById: async (id) => {
      if (get().project.id === id) return true;
      const slice = await getProjectSlice(id);
      if (!slice) return false;
      abortAllFrameRenders();
      await setActiveProjectId(id);
      set({
        project: slice.project,
        styleConfigs: slice.styleConfigs,
        scenes: slice.scenes,
        renders: slice.renders,
        frames: slice.frames,
        renderingFrameIds: {},
        frameRenderErrors: {},
        generatingKitAssets: false,
        kitAssetGeneratingKeys: {},
        kitAssetRenderErrors: {},
      });
      return true;
    },

    openProject: async (id) => {
      const ok = await get().loadProjectById(id);
      if (!ok) return;
      navigate(pathForProjectStep(id, "script"));
    },

    createNewProject: async () => {
      abortAllFrameRenders();
      const template = projectFromConfigJson(defaultProjectJson);
      const newProjectId = crypto.randomUUID();
      const styleConfigs = template.styleConfigs.map((c) => {
        const newStyleId = crypto.randomUUID();
        const newAssetsId = crypto.randomUUID();
        const assets = structuredClone(c.assets);
        return {
          ...c,
          id: newStyleId,
          assets: { ...assets, id: newAssetsId },
        };
      });
      const slice: PersistableProjectSlice = {
        project: {
          ...template.project,
          id: newProjectId,
          name: "Untitled",
          prompt: "",
          fileLabel: undefined,
          createdAt: new Date(),
          styleConfigId: styleConfigs[0]!.id,
        },
        styleConfigs,
        scenes: [],
        renders: [],
        frames: [],
      };
      await putProjectSlice(slice);
      await setActiveProjectId(slice.project.id);
      set({
        project: slice.project,
        styleConfigs: slice.styleConfigs,
        scenes: slice.scenes,
        renders: slice.renders,
        frames: slice.frames,
        renderingFrameIds: {},
        frameRenderErrors: {},
        generatingKitAssets: false,
        kitAssetGeneratingKeys: {},
        kitAssetRenderErrors: {},
      });
      navigate(pathForProjectStep(slice.project.id, "script"));
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
        styleConfigs: sample.styleConfigs,
        scenes: sample.scenes,
        renders: sample.renders,
        frames: sample.frames,
        renderingFrameIds: {},
        frameRenderErrors: {},
        generatingKitAssets: false,
        kitAssetGeneratingKeys: {},
        kitAssetRenderErrors: {},
      });
    },
  };
});

export function selectCurrentProject(s: ProjectState): Project {
  return s.project;
}

/** Index of the style kit to show and edit — falls back to `0` when `styleConfigId` is missing or stale. */
function resolveActiveStyleConfigIndex(s: ProjectState): number {
  const id = s.project.styleConfigId;
  const idx = s.styleConfigs.findIndex((c) => c.id === id);
  if (idx >= 0) return idx;
  if (s.styleConfigs.length > 0) return 0;
  return -1;
}

export function selectResolvedStyleBundle(s: ProjectState): AssetBundle {
  const idx = resolveActiveStyleConfigIndex(s);
  if (idx < 0) return FALLBACK_RESOLVED_STYLE_BUNDLE;
  return s.styleConfigs[idx]!.assets;
}

export function selectScenes(s: ProjectState): Scene[] {
  return s.scenes;
}
