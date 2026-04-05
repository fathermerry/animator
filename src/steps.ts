import { parseRoute, pathForProjectStep } from "@/router";

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
      "Script and scene beats for the film. The script step is where you shape the narrative; style and render build on it.",
  },
  {
    slug: "style",
    label: "Style",
    title: "Style",
    body:
      "Visual direction and kit for the film: overall style description, world and character direction, typography, and transparent PNGs for the cast. Direction text guides the narrative model—pixels come from your kit; Remotion composes the animation.",
  },
  {
    slug: "render",
    label: "Render",
    title: "Render",
    body:
      "The construction layer. Takes project content and style kit and produces frames and sequences. Starts with text and geometry, grows toward richer elements over time.",
  },
] as const;

export function stepBySlug(slug: string): Step | undefined {
  return STEPS.find((s) => s.slug === slug);
}

/** True when `path` is Script, Style, or Render (in-project workflow), not top-level Projects/Renders. */
export function isWorkflowStepPath(path: string): boolean {
  const r = parseRoute(path);
  return r.kind === "workflow" || r.kind === "legacyWorkflow";
}

/** 0 = projects list (`#/projects`), 1…STEPS.length = first…last workflow step */
export function getFlowIndex(path: string): number {
  const r = parseRoute(path);
  if (r.kind === "home" || r.kind === "projects") return 0;
  if (r.kind === "legacyWorkflow") {
    const i = STEPS.findIndex((s) => s.slug === r.stepSlug);
    return i >= 0 ? i + 1 : -1;
  }
  if (r.kind === "workflow") {
    const i = STEPS.findIndex((s) => s.slug === r.stepSlug);
    return i >= 0 ? i + 1 : -1;
  }
  return -1;
}

export function pathForFlowIndex(index: number, projectId: string): string {
  if (index <= 0) return "/projects";
  const step = STEPS[index - 1];
  return step ? pathForProjectStep(projectId, step.slug) : "/projects";
}

export const FLOW_MAX = STEPS.length;
