/** Must stay aligned with {@link STEPS} slugs in `steps.ts`. */
const WORKFLOW_STEP_SLUGS = new Set(["story", "compose"]);

/** Map legacy or alternate step segments to the canonical slug. */
function normalizeWorkflowStepSlug(step: string): string {
  if (step === "story" || step === "compose") return step;
  if (step === "script" || step === "studio") return "story";
  if (step === "style" || step === "assets" || step === "render" || step === "film") return "compose";
  return step;
}

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
    const legacy = normalizeWorkflowStepSlug(a);
    if (WORKFLOW_STEP_SLUGS.has(legacy)) return { kind: "legacyWorkflow", stepSlug: legacy };
  }

  if (segments.length >= 2 && isUuidLike(a)) {
    const step = segments[1]!;
    const normalized = normalizeWorkflowStepSlug(step);
    if (WORKFLOW_STEP_SLUGS.has(normalized)) {
      return { kind: "workflow", projectId: a, stepSlug: normalized };
    }
  }

  return { kind: "notFound" };
}

export function pathForProjectStep(projectId: string, stepSlug: string): string {
  return `/${projectId}/${stepSlug}`;
}

/** When the hash still uses a legacy step slug, rewrite to the canonical one. */
export function canonicalWorkflowPathIfNeeded(path: string): string | null {
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 2 && isUuidLike(segments[0]!)) {
    const projectId = segments[0]!;
    const normalized = normalizeWorkflowStepSlug(segments[1]!);
    if (normalized !== segments[1] && WORKFLOW_STEP_SLUGS.has(normalized)) {
      return pathForProjectStep(projectId, normalized);
    }
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
