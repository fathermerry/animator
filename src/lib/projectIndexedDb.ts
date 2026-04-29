import { buildDefaultProjectBundle } from "@/data/defaultProjectSeed";
import { idbKvDelete, idbKvGet, idbKvSet, openAnimatorDb, PROJECTS_STORE } from "@/lib/indexedDbKv";
import { isStructuralFrameShellRender, renderTargetProviderFromEngine, targetMediaTypeFromEngine } from "@/lib/renderDisplay";
import { enrichRenderList, projectFromConfigJson } from "@/lib/projectHydrate";
import {
  type LegacyPersistableProjectSlice,
  migratePersistableProjectSlice,
  type PersistableProjectSlice,
  PROJECT_IDB_KEY,
} from "@/lib/projectPersistence";
import {
  deleteRemoteProjectRecord,
  getRemoteProjectRecord,
  getRemoteProjectRecords,
  type RemoteProjectRecord,
  upsertRemoteProjectRecord,
} from "@/lib/projectSupabase";
import { LEGACY_PLACEHOLDER_PROJECT_ID, SAMPLE_PROJECT_ID } from "@/lib/sampleProject";
import type { Render } from "@/types/project";

const ACTIVE_PROJECT_KEY = "activeProjectId";
const REMOTE_PROJECT_SYNC_TIMEOUT_MS = 1500;

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

function summarizeProjectRows(rows: ProjectRecord[]): ProjectSummary[] {
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

export async function projectStoreGet(id: string): Promise<ProjectRecord | undefined> {
  const db = await openAnimatorDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readonly");
    const r = tx.objectStore(PROJECTS_STORE).get(id);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result as ProjectRecord | undefined);
  });
}

export async function projectStorePut(record: ProjectRecord): Promise<void> {
  const db = await openAnimatorDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(PROJECTS_STORE).put(record);
  });
}

export async function projectStoreDelete(id: string): Promise<void> {
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

function remoteRecordToLocal(record: RemoteProjectRecord): ProjectRecord {
  return {
    id: record.id,
    updatedAt: record.updatedAt,
    ...(record.isSample ? { isSample: true } : {}),
    slice: record.slice,
  };
}

async function syncRemoteProjectsToIndexedDb(): Promise<void> {
  const [localRows, remoteRows] = await Promise.all([
    projectStoreGetAll(),
    getRemoteProjectRecords(),
  ]);
  const localById = new Map(localRows.map((row) => [row.id, row]));
  const remoteById = new Map(remoteRows.map((row) => [row.id, row]));

  for (const remote of remoteRows) {
    const local = localById.get(remote.id);
    if (!local || local.updatedAt < remote.updatedAt) {
      await projectStorePut(remoteRecordToLocal(remote));
    }
  }

  for (const local of localRows) {
    if (local.id === SAMPLE_PROJECT_ID) continue;
    const remote = remoteById.get(local.id);
    if (!remote || remote.updatedAt < local.updatedAt) {
      await upsertRemoteProjectRecord(local);
    }
  }
}

async function syncRemoteProjectsToIndexedDbWithTimeout(): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      syncRemoteProjectsToIndexedDb().then(() => true),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), REMOTE_PROJECT_SYNC_TIMEOUT_MS);
      }),
    ]);
  } catch (e: unknown) {
    console.warn("Project remote sync failed", e);
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function getRemoteProjectRecordWithTimeout(id: string): Promise<RemoteProjectRecord | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getRemoteProjectRecord(id),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), REMOTE_PROJECT_SYNC_TIMEOUT_MS);
      }),
    ]);
  } catch (e: unknown) {
    console.warn("Could not load remote project", e);
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function getActiveProjectId(): Promise<string | undefined> {
  return idbKvGet<string>(ACTIVE_PROJECT_KEY);
}

export async function setActiveProjectId(id: string): Promise<void> {
  await idbKvSet(ACTIVE_PROJECT_KEY, id);
}

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const localRows = await projectStoreGetAll();
  const synced = await syncRemoteProjectsToIndexedDbWithTimeout();
  if (!synced) return summarizeProjectRows(localRows);
  return summarizeProjectRows(await projectStoreGetAll());
}

/** One persisted render plus project and scene labels for cross-project lists. */
export type RenderListRow = {
  render: Render;
  projectId: string;
  projectLabel: string;
  sceneTitle: string | null;
};

function coerceOptionalRenderDate(raw: Date | string | undefined): Date | undefined {
  if (raw == null) return undefined;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function coerceRenderCreatedAt(render: Render): Render {
  const createdAt =
    render.createdAt instanceof Date
      ? render.createdAt
      : new Date(String(render.createdAt));
  const type =
    render.type === "asset" ||
    render.type === "reference" ||
    render.type === "narration" ||
    render.type === "script" ||
    render.type === "storyboard"
      ? render.type
      : "frame";
  const { startedAt: _st, endedAt: _en, ...rest } = render;
  const startedAt = coerceOptionalRenderDate(render.startedAt);
  const endedAt = coerceOptionalRenderDate(render.endedAt);
  return {
    ...rest,
    createdAt,
    type,
    ...(startedAt ? { startedAt } : {}),
    ...(endedAt ? { endedAt } : {}),
  };
}

/** All renders from every project in IndexedDB, newest first. */
export async function listAllRendersAcrossProjects(): Promise<RenderListRow[]> {
  const records = await projectStoreGetAll();
  const out: RenderListRow[] = [];
  for (const row of records) {
    const migrated = migratePersistableProjectSlice(
      row.slice as PersistableProjectSlice | LegacyPersistableProjectSlice,
    );
    const withTargetPlaceholders: Render[] = migrated.renders.map((r) => {
      const t = (r as { target?: { name?: string } }).target;
      if (t && typeof t === "object" && typeof t.name === "string") {
        return r as Render;
      }
      return {
      ...(r as object),
      target: {
        type: targetMediaTypeFromEngine((r as Render).engine),
        name: "",
        provider: renderTargetProviderFromEngine((r as Render).engine),
      },
    } as Render;
    });
    const renders = enrichRenderList(
      withTargetPlaceholders,
      migrated.scenes,
      migrated.frames,
      migrated.project,
      migrated.styleConfigs,
    );
    const p = migrated.project;
    const projectLabel = p.fileLabel?.trim() || p.name?.trim() || "Untitled";
    const scenes = migrated.scenes;
    for (const render of renders) {
      const r = coerceRenderCreatedAt(render);
      if (isStructuralFrameShellRender(r)) continue;
      const scene = scenes.find((s) => s.id === r.sceneId);
      out.push({
        render: r,
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
  const remote = await getRemoteProjectRecordWithTimeout(id);
  if (remote) {
    const local = await projectStoreGet(id);
    if (!local || local.updatedAt < remote.updatedAt) {
      await projectStorePut(remoteRecordToLocal(remote));
    }
  }
  const row = await projectStoreGet(id);
  if (!row?.slice) return null;
  const migrated = migratePersistableProjectSlice(
    row.slice as PersistableProjectSlice | LegacyPersistableProjectSlice,
  );
  const withTargetPlaceholders: Render[] = migrated.renders.map((r) => {
    const t = (r as { target?: { name?: string } }).target;
    if (t && typeof t === "object" && typeof t.name === "string") {
      return r as Render;
    }
    return {
      ...(r as object),
      target: {
        type: targetMediaTypeFromEngine((r as Render).engine),
        name: "",
        provider: renderTargetProviderFromEngine((r as Render).engine),
      },
    } as Render;
  });
  return {
    ...migrated,
    renders: enrichRenderList(
      withTargetPlaceholders,
      migrated.scenes,
      migrated.frames,
      migrated.project,
      migrated.styleConfigs,
    ),
  };
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
  await upsertRemoteProjectRecord(record).catch((e: unknown) => {
    console.warn("Project remote persist failed", e);
  });
}

export async function deleteProjectRecord(id: string): Promise<void> {
  if (id === SAMPLE_PROJECT_ID) return;
  await projectStoreDelete(id);
  await deleteRemoteProjectRecord(id).catch((e: unknown) => {
    console.warn("Project remote delete failed", e);
  });
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

  const bundle = buildDefaultProjectBundle();
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
  await syncRemoteProjectsToIndexedDbWithTimeout();

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
    const bundle = buildDefaultProjectBundle();
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
