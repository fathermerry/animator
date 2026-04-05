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

  const styleConfigId =
    typeof o.styleConfigId === "string" && o.styleConfigId.trim()
      ? o.styleConfigId.trim()
      : typeof o.assetsConfigId === "string" && o.assetsConfigId.trim()
        ? o.assetsConfigId.trim()
        : "";

  const styleConfigs = Array.isArray(o.styleConfigs)
    ? o.styleConfigs
    : Array.isArray(o.assetsConfigs)
      ? o.assetsConfigs
      : [];

  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id : crypto.randomUUID(),
    name: typeof o.name === "string" ? o.name : "Untitled",
    createdAt: o.createdAt ?? now,
    prompt: typeof o.prompt === "string" ? o.prompt : "",
    styleConfigId,
    scenes: Array.isArray(o.scenes) ? o.scenes : [],
    renders: Array.isArray(o.renders) ? o.renders : [],
    frames: Array.isArray(o.frames) ? o.frames : [],
    styleConfigs,
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
