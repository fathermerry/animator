export type Step = {
  slug: string;
  label: string;
  title: string;
  body: string;
};

export const STEPS: readonly Step[] = [
  {
    slug: "script",
    label: "Script",
    title: "Script",
    body:
      "Script and scene beats for the film. The script step is where you shape the narrative; assets and render build on it.",
  },
  {
    slug: "assets",
    label: "Assets",
    title: "Assets",
    body:
      "Visual kit for the film: world and character direction, typography, and transparent PNG assets for the cast. Direction text guides the narrative model—pixels come from your kit; Remotion composes the animation.",
  },
  {
    slug: "render",
    label: "Render",
    title: "Render",
    body:
      "The construction layer. Takes project content and assets and produces frames and sequences. Starts with text and geometry, grows toward richer elements over time.",
  },
] as const;

export function stepBySlug(slug: string): Step | undefined {
  return STEPS.find((s) => s.slug === slug);
}

/** True when `path` is Script, Assets, or Render (in-project workflow), not top-level Projects/Renders. */
export function isWorkflowStepPath(path: string): boolean {
  const slug = path.split("/").filter(Boolean)[0];
  return slug !== undefined && STEPS.some((s) => s.slug === slug);
}

/** 0 = projects list (`#/projects`), 1…STEPS.length = first…last workflow step */
export function getFlowIndex(path: string): number {
  const segments = path.split("/").filter(Boolean);
  if (path === "/" || segments.length === 0 || segments[0] === "projects") return 0;
  const slug = segments[0];
  const i = STEPS.findIndex((s) => s.slug === slug);
  return i >= 0 ? i + 1 : -1;
}

export function pathForFlowIndex(index: number): string {
  if (index <= 0) return "/projects";
  const step = STEPS[index - 1];
  return step ? `/${step.slug}` : "/projects";
}

export const FLOW_MAX = STEPS.length;
