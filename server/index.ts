import "dotenv/config";

import cors from "cors";
import express from "express";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import OpenAI from "openai";

import { SAMPLE_PROJECT_ID } from "../src/lib/sampleProject.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const publicRenders = path.join(repoRoot, "public", "renders");

const PORT = Number(process.env.RENDER_API_PORT ?? 8787);

/** OpenAI Images `prompt` max length (same as client-side assembly). */
const OPENAI_IMAGE_PROMPT_MAX_CHARS = 4000;

/** OpenAI TTS input limit (characters). */
const OPENAI_TTS_INPUT_MAX_CHARS = 4096;
const OPENAI_STORY_INPUT_MAX_CHARS = 12000;

type Cost = {
  amount: number;
  currency: string;
  breakdown: { label: string; amount: number }[];
};

function clampPromptForOpenAiImages(prompt: string): string {
  if (prompt.length <= OPENAI_IMAGE_PROMPT_MAX_CHARS) return prompt;
  const note = "\n[Truncated]";
  return prompt.slice(0, Math.max(0, OPENAI_IMAGE_PROMPT_MAX_CHARS - note.length)) + note;
}

type ImageModel =
  | "gpt-image-1.5"
  | "gpt-image-1-mini"
  | "dall-e-3"
  | "dall-e-2";

function isGptImageModel(m: ImageModel): boolean {
  return m === "gpt-image-1.5" || m === "gpt-image-1-mini";
}

function resolveModel(modelId: unknown): ImageModel {
  if (modelId === "gpt-image-1-mini") return "gpt-image-1-mini";
  if (modelId === "dall-e-2") return "dall-e-2";
  if (modelId === "dall-e-3") return "dall-e-3";
  if (modelId === "gpt-image-1.5") return "gpt-image-1.5";
  return "gpt-image-1.5";
}

type OpenAiImageSize =
  | "1024x1024"
  | "512x512"
  | "256x256"
  | "1536x1024"
  | "1792x1024"
  | "1024x1792";

function resolveGenerateSize(
  model: ImageModel,
  aspectRatio: "1:1" | "16:9" | undefined,
): OpenAiImageSize {
  const wide = aspectRatio === "16:9";
  if (model === "dall-e-2") {
    return "1024x1024";
  }
  if (model === "dall-e-3") {
    return wide ? "1792x1024" : "1024x1024";
  }
  // GPT Image models: landscape uses 1536×1024 (API widescreen preset).
  if (isGptImageModel(model)) {
    return wide ? "1536x1024" : "1024x1024";
  }
  return "1024x1024";
}

/** Approximate list-price USD per image for the exact params we send to `images.generate`. OpenAI does not return dollars on this response. */
function estimatedUsdForImageGeneration(model: ImageModel, size: OpenAiImageSize): number {
  if (model === "dall-e-2") {
    if (size === "256x256") return 0.016;
    if (size === "512x512") return 0.018;
    return 0.02;
  }
  if (model === "dall-e-3") {
    // We only request `quality: "standard"` for DALL·E 3 today.
    if (size === "1792x1024" || size === "1024x1792") return 0.08;
    return 0.04;
  }
  if (model === "gpt-image-1-mini") {
    if (size === "1536x1024") return 0.028;
    return 0.02;
  }
  if (size === "1536x1024") return 0.048;
  return 0.034;
}

function costForImageGeneration(args: {
  model: ImageModel;
  size: OpenAiImageSize;
  usage?: { total_tokens?: number };
}): Cost {
  const amount = estimatedUsdForImageGeneration(args.model, args.size);
  const tokens = args.usage?.total_tokens;
  const tokenSuffix =
    typeof tokens === "number" && Number.isFinite(tokens) ? ` · ${tokens} tokens` : "";
  return {
    amount,
    currency: "USD",
    breakdown: [
      {
        label: `OpenAI image (${args.model}${tokenSuffix}, estimate)`,
        amount,
      },
    ],
  };
}

const TEXT_MODEL_PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
};

function costForTextGeneration(args: {
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}): Cost {
  const pricing = TEXT_MODEL_PRICING_USD_PER_1M[args.model] ?? TEXT_MODEL_PRICING_USD_PER_1M["gpt-4.1-mini"]!;
  const inputTokens = Math.max(0, Math.floor(args.usage?.prompt_tokens ?? 0));
  const outputTokens = Math.max(0, Math.floor(args.usage?.completion_tokens ?? 0));
  const inputAmount = (inputTokens / 1_000_000) * pricing.input;
  const outputAmount = (outputTokens / 1_000_000) * pricing.output;
  const totalTokens = args.usage?.total_tokens;
  const tokenSuffix =
    typeof totalTokens === "number" && Number.isFinite(totalTokens)
      ? ` · ${totalTokens} tokens`
      : "";
  return {
    amount: inputAmount + outputAmount,
    currency: "USD",
    breakdown: [
      {
        label: `OpenAI text input (${args.model}${tokenSuffix}, estimate)`,
        amount: inputAmount,
      },
      {
        label: `OpenAI text output (${args.model}${tokenSuffix}, estimate)`,
        amount: outputAmount,
      },
    ],
  };
}

function costForTts(args: { model: string; characters: number }): Cost {
  const chars = Math.max(0, Math.floor(args.characters));
  const ratePer1M = args.model === "tts-1-hd" ? 30 : 15;
  const amount = (chars / 1_000_000) * ratePer1M;
  return {
    amount,
    currency: "USD",
    breakdown: [
      {
        label: `OpenAI speech (${args.model} · ${chars} chars, estimate)`,
        amount,
      },
    ],
  };
}

type StoryboardSceneDraft = {
  title: string;
  description: string;
  voiceoverText: string;
  durationSeconds: number;
  frames: { description: string }[];
};

function clampStoryInput(story: string): string {
  if (story.length <= OPENAI_STORY_INPUT_MAX_CHARS) return story;
  const note = "\n[Truncated]";
  return story.slice(0, Math.max(0, OPENAI_STORY_INPUT_MAX_CHARS - note.length)) + note;
}

function sanitizeStoryboardScenes(raw: unknown): StoryboardSceneDraft[] {
  const root = raw && typeof raw === "object" ? raw as { scenes?: unknown } : {};
  if (!Array.isArray(root.scenes)) return [];
  return root.scenes.slice(0, 12).map((item, idx): StoryboardSceneDraft | null => {
    if (!item || typeof item !== "object") return null;
    const x = item as Record<string, unknown>;
    const title = typeof x.title === "string" ? x.title.trim() : "";
    const description = typeof x.description === "string" ? x.description.trim() : "";
    const voiceoverText = typeof x.voiceoverText === "string" ? x.voiceoverText.trim() : "";
    const durationRaw = typeof x.durationSeconds === "number" ? x.durationSeconds : 8;
    const durationSeconds = Math.max(3, Math.min(45, Math.round(durationRaw)));
    const framesRaw = Array.isArray(x.frames) ? x.frames : [];
    const frames = framesRaw
      .slice(0, 4)
      .map((fr) => {
        if (!fr || typeof fr !== "object") return null;
        const desc = typeof (fr as { description?: unknown }).description === "string"
          ? (fr as { description: string }).description.trim()
          : "";
        return desc ? { description: desc } : null;
      })
      .filter((fr): fr is { description: string } => fr !== null);
    const fallbackDescription = description || voiceoverText || title || `Scene ${idx + 1}`;
    return {
      title: title || `Scene ${idx + 1}`,
      description: fallbackDescription,
      voiceoverText: voiceoverText || fallbackDescription,
      durationSeconds,
      frames: frames.length > 0 ? frames : [{ description: fallbackDescription }],
    };
  }).filter((scene): scene is StoryboardSceneDraft => scene !== null);
}

function safeSegment(id: string): string {
  return id.replace(/[^a-zA-Z0-9-_]/g, "_");
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

/** Serve generated stills and other `public/` files (same tree the render handler writes into). */
app.use(express.static(path.join(repoRoot, "public")));

app.post("/api/script", async (req, res) => {
  try {
    const body = req.body as {
      projectId?: string;
      story?: string;
    };
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const story = clampStoryInput(typeof body.story === "string" ? body.story.trim() : "");

    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }
    if (!story) {
      res.status(400).json({ error: "story is required" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      res.status(503).json({ error: "OPENAI_API_KEY is not set" });
      return;
    }

    const model = process.env.OPENAI_SCRIPT_MODEL?.trim() || "gpt-4.1-mini";
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "Turn the user's raw story idea into a clean short-film script for an image-to-video animation workflow. Keep it concise, visual, and scene-friendly. Include spoken narration/dialogue and clear beats, but do not create JSON.",
        },
        {
          role: "user",
          content: `Story idea:\n${story}`,
        },
      ],
    });

    const script = response.choices[0]?.message?.content?.trim() ?? "";
    if (!script) {
      res.status(502).json({ error: "Script model returned no text" });
      return;
    }

    res.json({
      script,
      model,
      cost: costForTextGeneration({ model, usage: response.usage }),
    });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Script generation failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/storyboard", async (req, res) => {
  try {
    const body = req.body as {
      projectId?: string;
      story?: string;
    };
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const story = clampStoryInput(typeof body.story === "string" ? body.story.trim() : "");

    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }
    if (!story) {
      res.status(400).json({ error: "story is required" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      res.status(503).json({ error: "OPENAI_API_KEY is not set" });
      return;
    }

    const model = process.env.OPENAI_STORY_MODEL?.trim() || "gpt-4.1-mini";
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You convert a confirmed short-film script into a compact image-to-video storyboard. Return only valid JSON with a scenes array. Each scene needs title, description, voiceoverText, durationSeconds, and 1-3 frames with description. Each frame description should be a concrete visual staging prompt for a single widescreen keyframe (also suitable as an I2V start frame). Use a simple consistent animated explainer style. Keep the wording concrete and visual.",
        },
        {
          role: "user",
          content: `Story:\n${story}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      res.status(502).json({ error: "Storyboard model returned invalid JSON" });
      return;
    }

    const scenes = sanitizeStoryboardScenes(parsed);
    if (scenes.length === 0) {
      res.status(502).json({ error: "Storyboard model returned no scenes" });
      return;
    }

    res.json({
      scenes,
      model,
      cost: costForTextGeneration({ model, usage: response.usage }),
    });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Storyboard failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/render-frame", async (req, res) => {
  try {
    const body = req.body as {
      projectId?: string;
      frameId?: string;
      prompt?: string;
      modelId?: string;
      aspectRatio?: string;
    };
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const frameId = typeof body.frameId === "string" ? body.frameId.trim() : "";
    const rawPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const prompt = clampPromptForOpenAiImages(rawPrompt);

    if (!projectId || !frameId) {
      res.status(400).json({ error: "projectId and frameId are required" });
      return;
    }
    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      res.status(503).json({ error: "OPENAI_API_KEY is not set" });
      return;
    }

    const model = resolveModel(body.modelId);
    const openai = new OpenAI({ apiKey });
    const ar = body.aspectRatio?.trim();
    const aspectRatio: "1:1" | "16:9" | undefined =
      ar === "16:9" ? "16:9" : ar === "1:1" ? "1:1" : undefined;
    const size = resolveGenerateSize(model, aspectRatio);

    // GPT Image models always return `b64_json`; `response_format` is DALL·E-only (400 if sent).
    const response = await openai.images.generate({
      model,
      prompt,
      n: 1,
      size,
      ...(isGptImageModel(model)
        ? { quality: "medium" as const }
        : {
            response_format: "b64_json" as const,
            ...(model === "dall-e-3" ? { quality: "standard" as const } : {}),
          }),
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      res.status(502).json({ error: "No image data returned from OpenAI" });
      return;
    }

    const dir = path.join(publicRenders, safeSegment(projectId));
    await mkdir(dir, { recursive: true });
    const fileName = `${safeSegment(frameId)}.png`;
    const filePath = path.join(dir, fileName);
    await writeFile(filePath, Buffer.from(b64, "base64"));

    const imageUrl = `/renders/${safeSegment(projectId)}/${fileName}`;
    /** Same bytes as on disk — lets the client show the still without a follow-up GET to `/renders/...`. */
    const imageDataUrl = `data:image/png;base64,${b64}`;
    const cost = costForImageGeneration({
      model,
      size,
      usage: response.usage,
    });

    res.json({
      imageUrl,
      imageDataUrl,
      model,
      cost,
    });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Render failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/narration", async (req, res) => {
  try {
    const body = req.body as {
      projectId?: string;
      sceneId?: string;
      text?: string;
    };
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const sceneId = typeof body.sceneId === "string" ? body.sceneId.trim() : "";
    let text = typeof body.text === "string" ? body.text.trim() : "";
    if (!projectId || !sceneId) {
      res.status(400).json({ error: "projectId and sceneId are required" });
      return;
    }
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    if (text.length > OPENAI_TTS_INPUT_MAX_CHARS) {
      const note = "\n[Truncated]";
      text =
        text.slice(0, Math.max(0, OPENAI_TTS_INPUT_MAX_CHARS - note.length)) + note;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      res.status(503).json({ error: "OPENAI_API_KEY is not set" });
      return;
    }

    const openai = new OpenAI({ apiKey });
    const model = "tts-1";
    const speech = await openai.audio.speech.create({
      model,
      voice: "alloy",
      input: text,
    });

    const arrayBuffer = await speech.arrayBuffer();
    const dir = path.join(publicRenders, safeSegment(projectId));
    await mkdir(dir, { recursive: true });
    const fileName = `narration-${safeSegment(sceneId)}.mp3`;
    const filePath = path.join(dir, fileName);
    await writeFile(filePath, Buffer.from(arrayBuffer));

    const audioUrl = `/renders/${safeSegment(projectId)}/${fileName}`;
    res.json({
      audioUrl,
      model,
      cost: costForTts({ model, characters: text.length }),
    });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Narration failed";
    res.status(500).json({ error: message });
  }
});

/** Remove `public/renders/{projectId}/` for the bundled sample project only (no arbitrary deletes). */
app.delete("/api/project-renders/:projectId", async (req, res) => {
  const projectId = typeof req.params.projectId === "string" ? req.params.projectId.trim() : "";
  if (projectId !== SAMPLE_PROJECT_ID) {
    res.status(403).json({ error: "Only the sample project renders folder can be cleared" });
    return;
  }
  try {
    const dir = path.join(publicRenders, safeSegment(projectId));
    await rm(dir, { recursive: true, force: true });
    res.status(204).end();
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Failed to remove renders folder";
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Render API listening on http://127.0.0.1:${PORT}`);
});
