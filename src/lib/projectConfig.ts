/**
 * Normalizes a JSON project config into a seed `projectFromConfigJson` can hydrate.
 */
export function normalizeProjectConfigSeed(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") {
    return minimalSeed();
  }
  const o = raw as Record<string, unknown>;
  const now = new Date().toISOString();
  const fileLabel =
    typeof o.fileLabel === "string" && o.fileLabel.trim() ? o.fileLabel.trim() : undefined;
  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id : crypto.randomUUID(),
    name: typeof o.name === "string" ? o.name : "Untitled",
    createdAt: o.createdAt ?? now,
    prompt: typeof o.prompt === "string" ? o.prompt : "",
    styleConfigId: typeof o.styleConfigId === "string" ? o.styleConfigId : "",
    scenes: Array.isArray(o.scenes) ? o.scenes : [],
    renders: Array.isArray(o.renders) ? o.renders : [],
    frames: Array.isArray(o.frames) ? o.frames : [],
    styleConfigs: Array.isArray(o.styleConfigs) ? o.styleConfigs : [],
    ...(fileLabel ? { fileLabel } : {}),
  };
}

function minimalSeed(): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Untitled",
    createdAt: now,
    prompt: "",
    styleConfigId: "",
    scenes: [],
    renders: [],
    frames: [],
    styleConfigs: [],
  };
}
