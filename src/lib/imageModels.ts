/** OpenAI image models supported by the first render engine (server must accept the same ids). */
export const OPENAI_IMAGE_MODEL_OPTIONS = [
  { id: "gpt-image-1.5", label: "GPT Image 1.5" },
  { id: "gpt-image-1-mini", label: "GPT Image 1 Mini" },
] as const;

export type OpenAiImageModelId = (typeof OPENAI_IMAGE_MODEL_OPTIONS)[number]["id"];

export const DEFAULT_OPENAI_IMAGE_MODEL: OpenAiImageModelId = "gpt-image-1.5";

export function isOpenAiImageModelId(s: string): s is OpenAiImageModelId {
  return OPENAI_IMAGE_MODEL_OPTIONS.some((o) => o.id === s);
}
