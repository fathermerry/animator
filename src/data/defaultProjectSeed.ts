import defaultProjectJson from "./default-project.json";
import storyMarkdown from "./story.md?raw";

import { projectFromConfigJson } from "@/lib/projectHydrate";

/** Canonical bundled seed object before hydration (story body from `story.md`). */
export function buildDefaultProjectSeed(): Record<string, unknown> {
  const body = typeof storyMarkdown === "string" ? storyMarkdown : String(storyMarkdown);
  return {
    ...defaultProjectJson,
    prompt: body.trimEnd(),
    fileLabel: "story.md",
  };
}

export function buildDefaultProjectBundle() {
  return projectFromConfigJson(buildDefaultProjectSeed());
}
