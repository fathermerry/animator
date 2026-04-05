import type { Cost } from "@/types/project";

export const DEFAULT_IMAGE_MODEL_ID = "dall-e-3";

export type RenderFrameRequestBody = {
  projectId: string;
  frameId: string;
  prompt: string;
  modelId?: string;
};

export type RenderFrameResponse = {
  imageUrl: string;
  model: string;
  cost: Cost;
};

export async function requestFrameImageRender(
  body: RenderFrameRequestBody,
  signal?: AbortSignal,
): Promise<RenderFrameResponse> {
  const res = await fetch("/api/render-frame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: body.projectId,
      frameId: body.frameId,
      prompt: body.prompt,
      modelId: body.modelId ?? DEFAULT_IMAGE_MODEL_ID,
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

  return JSON.parse(text) as RenderFrameResponse;
}
