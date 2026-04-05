import type { AssetsConfig } from "@/types/assetsConfig";
import type { Frame, Project, Render, Scene } from "@/types/project";

/** IndexedDB key for the bundled local adapter; keep stable across app versions when possible. */
export const PROJECT_IDB_KEY = "project-config-v1";

export type PersistableProjectSlice = {
  project: Project;
  assetsConfigs: AssetsConfig[];
  scenes: Scene[];
  renders: Render[];
  frames: Frame[];
};

/** Shape compatible with {@link projectFromConfigJson} / default project JSON files. */
export function projectSliceToConfigJson(slice: PersistableProjectSlice): Record<string, unknown> {
  const p = slice.project;
  return {
    schemaVersion: 2,
    id: p.id,
    name: p.name,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    prompt: p.prompt,
    assetsConfigId: p.assetsConfigId,
    ...(p.fileLabel ? { fileLabel: p.fileLabel } : {}),
    assetsConfigs: slice.assetsConfigs,
    scenes: slice.scenes,
    renders: slice.renders,
    frames: slice.frames,
  };
}

export function serializeProjectSlice(slice: PersistableProjectSlice): string {
  return JSON.stringify(projectSliceToConfigJson(slice), (_, v) =>
    v instanceof Date ? v.toISOString() : v,
  );
}

/** Trigger a browser download of the project as JSON (import-compatible). */
export function downloadPersistableProjectSlice(slice: PersistableProjectSlice): void {
  const json = serializeProjectSlice(slice);
  const raw = slice.project.fileLabel?.trim() || slice.project.name?.trim() || "project";
  const safe = raw.replace(/[^\w\-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "project";
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.json`;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
