export type NarrationRequestBody = {
  projectId: string;
  sceneId: string;
  text: string;
};

export type NarrationResponse = {
  audioUrl: string;
};

export async function requestSceneNarration(
  body: NarrationRequestBody,
  signal?: AbortSignal,
): Promise<NarrationResponse> {
  const res = await fetch("/api/narration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: body.projectId,
      sceneId: body.sceneId,
      text: body.text,
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

  return JSON.parse(text) as NarrationResponse;
}
