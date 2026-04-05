/** OpenAI image models supported by the first render engine (server must accept the same ids). */
export const OPENAI_IMAGE_MODEL_OPTIONS = [
  { id: "dall-e-3", label: "DALL·E 3" },
  { id: "dall-e-2", label: "DALL·E 2" },
] as const;

export type OpenAiImageModelId = (typeof OPENAI_IMAGE_MODEL_OPTIONS)[number]["id"];

export const DEFAULT_OPENAI_IMAGE_MODEL: OpenAiImageModelId = "dall-e-3";

export function isOpenAiImageModelId(s: string): s is OpenAiImageModelId {
  return OPENAI_IMAGE_MODEL_OPTIONS.some((o) => o.id === s);
}
