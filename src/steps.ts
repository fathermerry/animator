import { parseRoute, pathForProjectStep } from "@/router";

export type Step = {
  slug: string;
  label: string;
  title: string;
  body: string;
};

export const STEPS: readonly Step[] = [
  {
    slug: "story",
    label: "Story",
    title: "Story",
    body: "Write the narrative and high-level plan for the film.",
  },
  {
    slug: "compose",
    label: "Compose",
    title: "Compose",
    body: "Shots, keyframes, timing, and build preview.",
  },
] as const;

export function stepBySlug(slug: string): Step | undefined {
  return STEPS.find((s) => s.slug === slug);
}

/** True when `path` is Story, Style, or Compose (in-project workflow), not top-level Projects/Cost. */
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
