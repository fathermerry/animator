import { projectFromConfigJson, type HydratedProjectBundle } from "@/lib/projectHydrate";

/** Reads project JSON and returns a hydrated bundle (project, assets configs, scenes, renders, frames). */
export async function loadProjectConfigFromFile(file: File): Promise<HydratedProjectBundle> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Invalid JSON");
  }
  return projectFromConfigJson(parsed);
}
