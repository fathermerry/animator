/** Must stay aligned with {@link STEPS} slugs in `steps.ts`. */
const WORKFLOW_STEP_SLUGS = new Set(["script", "style", "render"]);

function isUuidLike(s: string): boolean {
  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(s);
}

export type ParsedRoute =
  | { kind: "home" }
  | { kind: "projects" }
  | { kind: "renders" }
  | { kind: "workflow"; projectId: string; stepSlug: string }
  | { kind: "legacyWorkflow"; stepSlug: string }
  | { kind: "notFound" };

export function parseRoute(path: string): ParsedRoute {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return { kind: "home" };

  const a = segments[0]!;
  if (a === "projects") return { kind: "projects" };
  if (a === "renders") return { kind: "renders" };

  if (segments.length === 1) {
    if (a === "assets") return { kind: "legacyWorkflow", stepSlug: "style" };
    if (WORKFLOW_STEP_SLUGS.has(a)) return { kind: "legacyWorkflow", stepSlug: a };
  }

  if (segments.length >= 2 && isUuidLike(a)) {
    const step = segments[1]!;
    const normalized = step === "assets" ? "style" : step;
    if (WORKFLOW_STEP_SLUGS.has(normalized)) {
      return { kind: "workflow", projectId: a, stepSlug: normalized };
    }
  }

  return { kind: "notFound" };
}

export function pathForProjectStep(projectId: string, stepSlug: string): string {
  return `/${projectId}/${stepSlug}`;
}

/** When the hash still uses the legacy `/assets` step, rewrite to `/style`. */
export function canonicalWorkflowPathIfNeeded(path: string): string | null {
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 2 && isUuidLike(segments[0]!) && segments[1] === "assets") {
    return pathForProjectStep(segments[0]!, "style");
  }
  return null;
}

export function getPath(): string {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return path === "" ? "/" : path;
}

export function navigate(path: string): void {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  window.location.hash = normalized;
}

export function onRouteChange(handler: () => void): () => void {
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}
