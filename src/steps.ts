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
    body:
      "Script and scene beats for the film. The story step is where you shape the narrative; assets and render build on it.",
  },
  {
    slug: "assets",
    label: "Assets",
    title: "Assets",
    body:
      "Visual kit for the film: world and character direction, typography, and transparent PNG assets for the cast. Direction text guides the story model—pixels come from your kit; Remotion composes the animation.",
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

/** 0 = home (`#/`), 1…STEPS.length = first…last step */
export function getFlowIndex(path: string): number {
  const segments = path.split("/").filter(Boolean);
  if (path === "/" || segments.length === 0) return 0;
  const slug = segments[0];
  const i = STEPS.findIndex((s) => s.slug === slug);
  return i >= 0 ? i + 1 : -1;
}

export function pathForFlowIndex(index: number): string {
  if (index <= 0) return "/";
  const step = STEPS[index - 1];
  return step ? `/${step.slug}` : "/";
}

export const FLOW_MAX = STEPS.length;
