import type { Cost } from "@/types/project";

export type ScriptRequestBody = {
  projectId: string;
  story: string;
};

export type ScriptResponse = {
  script: string;
  model: string;
  cost: Cost;
};

export async function requestScriptGeneration(
  body: ScriptRequestBody,
  signal?: AbortSignal,
): Promise<ScriptResponse> {
  const res = await fetch("/api/script", {
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

  return JSON.parse(text) as ScriptResponse;
}
