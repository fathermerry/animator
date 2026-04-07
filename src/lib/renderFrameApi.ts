import type { Cost } from "@/types/project";

export const DEFAULT_IMAGE_MODEL_ID = "gpt-image-1.5";

/** `16:9` maps to OpenAI landscape sizes per model (e.g. 1536×1024 for GPT Image, 1792×1024 for DALL·E 3). */
export type RenderFrameAspectRatio = "1:1" | "16:9";

export type RenderFrameRequestBody = {
  projectId: string;
  frameId: string;
  prompt: string;
  modelId?: string;
  /** Defaults to `1:1` (square). Use `16:9` for scene reference stills to match widescreen previews. */
  aspectRatio?: RenderFrameAspectRatio;
};

export type RenderFrameResponse = {
  imageUrl: string;
  /** Inline PNG (same as OpenAI `b64_json` / file on disk) for immediate `<img src>` without fetching `/renders/...`. */
  imageDataUrl?: string;
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
      ...(body.aspectRatio && body.aspectRatio !== "1:1" ? { aspectRatio: body.aspectRatio } : {}),
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
