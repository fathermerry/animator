import defaultProjectJson from "@/data/default-project.json";
import { idbKvDelete, idbKvGet, idbKvSet, openAnimatorDb, PROJECTS_STORE } from "@/lib/indexedDbKv";
import { projectFromConfigJson } from "@/lib/projectHydrate";
import {
  type LegacyPersistableProjectSlice,
  migratePersistableProjectSlice,
  type PersistableProjectSlice,
  PROJECT_IDB_KEY,
} from "@/lib/projectPersistence";
import { LEGACY_PLACEHOLDER_PROJECT_ID, SAMPLE_PROJECT_ID } from "@/lib/sampleProject";
import type { Render } from "@/types/project";

const ACTIVE_PROJECT_KEY = "activeProjectId";

export type ProjectRecord = {
  id: string;
  updatedAt: string;
  isSample?: boolean;
  slice: PersistableProjectSlice;
};

export type ProjectSummary = {
  id: string;
  name: string;
  fileLabel?: string;
  updatedAt: string;
  isSample: boolean;
};

function rewriteProjectId(slice: PersistableProjectSlice, newId: string): PersistableProjectSlice {
  const oldId = slice.project.id;
  if (oldId === newId) return slice;
  return {
    project: { ...slice.project, id: newId },
    styleConfigs: slice.styleConfigs,
    scenes: slice.scenes.map((s) => ({ ...s, projectId: newId })),
    renders: slice.renders.map((r) => ({ ...r, projectId: newId })),
    frames: slice.frames.map((f) => ({ ...f, projectId: newId })),
  };
}

async function projectStoreGet(id: string): Promise<ProjectRecord | undefined> {
  const db = await openAnimatorDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readonly");
    const r = tx.objectStore(PROJECTS_STORE).get(id);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result as ProjectRecord | undefined);
  });
}

async function projectStorePut(record: ProjectRecord): Promise<void> {
  const db = await openAnimatorDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(PROJECTS_STORE).put(record);
  });
}

async function projectStoreDelete(id: string): Promise<void> {
  const db = await openAnimatorDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(PROJECTS_STORE).delete(id);
  });
}

async function projectStoreGetAll(): Promise<ProjectRecord[]> {
  const db = await openAnimatorDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readonly");
    const r = tx.objectStore(PROJECTS_STORE).getAll();
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve((r.result as ProjectRecord[]) ?? []);
  });
}

export async function getActiveProjectId(): Promise<string | undefined> {
  return idbKvGet<string>(ACTIVE_PROJECT_KEY);
}

export async function setActiveProjectId(id: string): Promise<void> {
  await idbKvSet(ACTIVE_PROJECT_KEY, id);
}

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const rows = await projectStoreGetAll();
  return rows
    .map((row) => ({
      id: row.id,
      name: row.slice.project.name,
      fileLabel: row.slice.project.fileLabel,
      updatedAt: row.updatedAt,
      isSample: !!row.isSample || row.id === SAMPLE_PROJECT_ID,
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

/** One persisted render plus project and scene labels for cross-project lists. */
export type RenderListRow = {
  render: Render;
  projectId: string;
  projectLabel: string;
  sceneTitle: string | null;
};

function coerceRenderCreatedAt(render: Render): Render {
  const createdAt =
    render.createdAt instanceof Date
      ? render.createdAt
      : new Date(String(render.createdAt));
  const type = render.type === "asset" ? "asset" : "frame";
  return { ...render, createdAt, type };
}

/** All renders from every project in IndexedDB, newest first. */
export async function listAllRendersAcrossProjects(): Promise<RenderListRow[]> {
  const records = await projectStoreGetAll();
  const out: RenderListRow[] = [];
  for (const row of records) {
    const p = row.slice.project;
    const projectLabel = p.fileLabel?.trim() || p.name?.trim() || "Untitled";
    const scenes = row.slice.scenes;
    for (const raw of row.slice.renders) {
      const render = coerceRenderCreatedAt(raw);
      const scene = scenes.find((s) => s.id === render.sceneId);
      out.push({
        render,
        projectId: p.id,
        projectLabel,
        sceneTitle: scene?.title?.trim() ? scene.title.trim() : null,
      });
    }
  }
  out.sort((a, b) => b.render.createdAt.getTime() - a.render.createdAt.getTime());
  return out;
}

export async function getProjectSlice(id: string): Promise<PersistableProjectSlice | null> {
  const row = await projectStoreGet(id);
  if (!row?.slice) return null;
  return migratePersistableProjectSlice(row.slice as PersistableProjectSlice | LegacyPersistableProjectSlice);
}

export async function putProjectSlice(slice: PersistableProjectSlice): Promise<void> {
  const id = slice.project.id;
  const existing = await projectStoreGet(id);
  const isSample = existing?.isSample === true || id === SAMPLE_PROJECT_ID;
  const record: ProjectRecord = {
    id,
    updatedAt: new Date().toISOString(),
    ...(isSample ? { isSample: true } : {}),
    slice,
  };
  await projectStorePut(record);
}

export async function deleteProjectRecord(id: string): Promise<void> {
  if (id === SAMPLE_PROJECT_ID) return;
  await projectStoreDelete(id);
}

async function migrateLegacyProjectConfigKv(): Promise<void> {
  const raw = await idbKvGet<string>(PROJECT_IDB_KEY);
  if (typeof raw !== "string" || !raw.trim()) return;

  let slice: PersistableProjectSlice;
  try {
    const parsed: unknown = JSON.parse(raw);
    const bundle = projectFromConfigJson(parsed);
    slice = {
      project: bundle.project,
      styleConfigs: bundle.styleConfigs,
      scenes: bundle.scenes,
      renders: bundle.renders,
      frames: bundle.frames,
    };
  } catch {
    await idbKvDelete(PROJECT_IDB_KEY);
    return;
  }

  if (slice.project.id === LEGACY_PLACEHOLDER_PROJECT_ID) {
    slice = rewriteProjectId(slice, SAMPLE_PROJECT_ID);
  }

  await projectStorePut({
    id: slice.project.id,
    updatedAt: new Date().toISOString(),
    ...(slice.project.id === SAMPLE_PROJECT_ID ? { isSample: true } : {}),
    slice,
  });

  await idbKvDelete(PROJECT_IDB_KEY);

  const active = await getActiveProjectId();
  if (!active || active === LEGACY_PLACEHOLDER_PROJECT_ID) {
    await setActiveProjectId(slice.project.id);
  }
}

async function ensureSampleProjectSeeded(): Promise<void> {
  const existing = await projectStoreGet(SAMPLE_PROJECT_ID);
  if (existing) return;

  const bundle = projectFromConfigJson(defaultProjectJson);
  const slice: PersistableProjectSlice = {
    project: bundle.project,
    styleConfigs: bundle.styleConfigs,
    scenes: bundle.scenes,
    renders: bundle.renders,
    frames: bundle.frames,
  };

  await projectStorePut({
    id: SAMPLE_PROJECT_ID,
    updatedAt: new Date().toISOString(),
    isSample: true,
    slice,
  });
}

/**
 * One-time migration + sample seed + active id. Call before first paint.
 * Returns the slice for the active project.
 */
export async function runProjectDbBootstrap(): Promise<PersistableProjectSlice> {
  await migrateLegacyProjectConfigKv();
  await ensureSampleProjectSeeded();

  let activeId = await getActiveProjectId();
  if (!activeId) {
    activeId = SAMPLE_PROJECT_ID;
    await setActiveProjectId(activeId);
  }

  let slice = await getProjectSlice(activeId);
  if (!slice) {
    await setActiveProjectId(SAMPLE_PROJECT_ID);
    slice = await getProjectSlice(SAMPLE_PROJECT_ID);
  }
  if (!slice) {
    const bundle = projectFromConfigJson(defaultProjectJson);
    return {
      project: bundle.project,
      styleConfigs: bundle.styleConfigs,
      scenes: bundle.scenes,
      renders: bundle.renders,
      frames: bundle.frames,
    };
  }

  return slice;
}
