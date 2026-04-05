import type { StoreApi } from "zustand/vanilla";

import { putProjectSlice, runProjectDbBootstrap } from "@/lib/projectIndexedDb";
import type { PersistableProjectSlice } from "@/lib/projectPersistence";
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
  store.subscribe((state) => {
    storage.schedulePersist(() => ({
      project: state.project,
      assetsConfigs: state.assetsConfigs,
      scenes: state.scenes,
      renders: state.renders,
      frames: state.frames,
    }));
  });
}
