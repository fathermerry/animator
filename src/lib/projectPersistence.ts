import { reviveStyleConfig } from "@/lib/projectHydrate";
import type { StyleConfig } from "@/types/styleConfig";
import type { Frame, Project, Render, Scene } from "@/types/project";

/** IndexedDB key for the bundled local adapter; keep stable across app versions when possible. */
export const PROJECT_IDB_KEY = "project-config-v1";

export type PersistableProjectSlice = {
  project: Project;
  styleConfigs: StyleConfig[];
  scenes: Scene[];
  renders: Render[];
  frames: Frame[];
};

/** Legacy slice shape (IndexedDB rows saved before the style rename). */
export type LegacyPersistableProjectSlice = Omit<PersistableProjectSlice, "project" | "styleConfigs"> & {
  project: Project & { assetsConfigId?: string };
  assetsConfigs?: StyleConfig[];
  styleConfigs?: StyleConfig[];
};

/** Normalizes slices loaded from storage that may still use `assetsConfigId` / `assetsConfigs`. */
export function migratePersistableProjectSlice(
  slice: PersistableProjectSlice | LegacyPersistableProjectSlice,
): PersistableProjectSlice {
  const p = slice.project as Project & { assetsConfigId?: string };
  const project: Project = {
    id: p.id,
    name: p.name,
    fileLabel: p.fileLabel,
    createdAt: p.createdAt,
    prompt: p.prompt,
    styleConfigId: p.styleConfigId ?? p.assetsConfigId ?? "",
  };
  const rawStyleConfigs =
    slice.styleConfigs ??
    ("assetsConfigs" in slice && Array.isArray(slice.assetsConfigs) ? slice.assetsConfigs : []);
  const styleConfigs = rawStyleConfigs
    .map((c) => reviveStyleConfig(c))
    .filter((x): x is StyleConfig => x !== null);
  const renders = slice.renders.map(
    (r): Render => ({
      ...r,
      type: r.type === "asset" ? "asset" : "frame",
    }),
  );
  return { project, styleConfigs, scenes: slice.scenes, renders, frames: slice.frames };
}

/** Shape compatible with {@link projectFromConfigJson} / default project JSON files. */
export function projectSliceToConfigJson(slice: PersistableProjectSlice): Record<string, unknown> {
  const p = slice.project;
  return {
    schemaVersion: 2,
    id: p.id,
    name: p.name,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    prompt: p.prompt,
    styleConfigId: p.styleConfigId,
    ...(p.fileLabel ? { fileLabel: p.fileLabel } : {}),
    styleConfigs: slice.styleConfigs,
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
