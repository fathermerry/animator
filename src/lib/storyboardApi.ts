import type { Cost } from "@/types/project";

export type StoryboardFrameDraft = {
  description: string;
};

export type StoryboardSceneDraft = {
  title: string;
  description: string;
  voiceoverText: string;
  durationSeconds: number;
  frames: StoryboardFrameDraft[];
};

export type StoryboardRequestBody = {
  projectId: string;
  story: string;
};

export type StoryboardResponse = {
  scenes: StoryboardSceneDraft[];
  model: string;
  cost: Cost;
};

export async function requestStoryStoryboard(
  body: StoryboardRequestBody,
  signal?: AbortSignal,
): Promise<StoryboardResponse> {
  const res = await fetch("/api/storyboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: body.projectId,
      story: body.story,
    }),
    signal,
  });

  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (typeof j.error === "string" && j.error.trim()) message = j.error.trim();
    } catch {
      /* use raw text */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }

  return JSON.parse(text) as StoryboardResponse;
}
