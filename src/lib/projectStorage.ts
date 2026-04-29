import type { StoreApi } from "zustand/vanilla";

import { projectStoreGet, projectStorePut, putProjectSlice, runProjectDbBootstrap } from "@/lib/projectIndexedDb";
import type { PersistableProjectSlice } from "@/lib/projectPersistence";
import { subscribeToRemoteProject } from "@/lib/projectSupabase";
import type { ProjectState } from "@/store/projectStore";

const SAVE_DEBOUNCE_MS = 400;

/**
 * Local + remote persistence share the same canonical document: {@link PersistableProjectSlice}.
 * - **IndexedDB** (now): debounced saves per project id; bootstrap loads active project.
 * - **Supabase** (next): same slice as row JSON + Realtime broadcasts; merge/replace rules TBD.
 *
 * UI reads/writes only through Zustand; adapters are side effects — any step edits the same store.
 */
export type ProjectStorageAdapter = {
  bootstrap(): Promise<PersistableProjectSlice>;
  schedulePersist(getSlice: () => PersistableProjectSlice): void;
};

/** Optional hook for Postgres + Realtime: push/pull the same slice, resolve conflicts with server. */
export type ProjectRemoteSyncAdapter = {
  /** Subscribe to remote changes; return unsubscribe. Must apply updates via `store.setState`. */
  connect: (ctx: {
    projectId: string;
    store: StoreApi<ProjectState>;
    getSlice: () => PersistableProjectSlice;
  }) => () => void;
};

function createDebouncedPersist(
  write: (slice: PersistableProjectSlice) => Promise<void>,
): ProjectStorageAdapter["schedulePersist"] {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  return (getSlice) => {
    const gen = ++generation;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (gen !== generation) return;
      const slice = getSlice();
      void write(slice).catch((e: unknown) => {
        console.error("Project persist failed", e);
      });
    }, SAVE_DEBOUNCE_MS);
  };
}

export function createIndexedDbProjectStorage(): ProjectStorageAdapter {
  const schedulePersist = createDebouncedPersist(async (slice) => {
    await putProjectSlice(slice);
  });

  return {
    bootstrap: () => runProjectDbBootstrap(),
    schedulePersist,
  };
}

let defaultStorage: ProjectStorageAdapter | null = null;

export function getDefaultProjectStorage(): ProjectStorageAdapter {
  if (!defaultStorage) defaultStorage = createIndexedDbProjectStorage();
  return defaultStorage;
}

/**
 * Wire Zustand → storage. Call once at app init (before or after hydrate).
 * Swap {@link getDefaultProjectStorage} for a composite IDB + Supabase adapter later.
 */
export function attachProjectStorageToStore(
  store: StoreApi<ProjectState>,
  storage: ProjectStorageAdapter = getDefaultProjectStorage(),
): void {
  let suppressNextPersist = false;
  let activeRemoteProjectId: string | null = null;
  let unsubscribeRemoteProject: (() => void) | null = null;

  const connectRemoteProject = (projectId: string, force = false) => {
    if (!force && activeRemoteProjectId === projectId) return;
    unsubscribeRemoteProject?.();
    activeRemoteProjectId = projectId;
    unsubscribeRemoteProject = subscribeToRemoteProject(projectId, (record) => {
      if (!record) return;
      void (async () => {
        const local = await projectStoreGet(record.id);
        if (local && local.updatedAt >= record.updatedAt) return;
        await projectStorePut({
          id: record.id,
          updatedAt: record.updatedAt,
          ...(record.isSample ? { isSample: true } : {}),
          slice: record.slice,
        });
        if (store.getState().project.id !== record.id) return;
        suppressNextPersist = true;
        store.setState({
          project: record.slice.project,
          styleConfigs: record.slice.styleConfigs,
          scenes: record.slice.scenes,
          renders: record.slice.renders,
          frames: record.slice.frames,
          renderingFrameIds: {},
          frameRenderErrors: {},
          renderingAllFrameImages: false,
          kitAssetGeneratingKeys: {},
          kitAssetRenderErrors: {},
          narrationGeneratingKeys: {},
          narrationRenderErrors: {},
        });
      })().catch((e: unknown) => {
        console.warn("Remote project update failed", e);
      });
    });
  };

  connectRemoteProject(store.getState().project.id);

  store.subscribe((state) => {
    connectRemoteProject(state.project.id);
    if (suppressNextPersist) {
      suppressNextPersist = false;
      return;
    }
    storage.schedulePersist(() => ({
      project: state.project,
      styleConfigs: state.styleConfigs,
      scenes: state.scenes,
      renders: state.renders,
      frames: state.frames,
    }));
  });
}
