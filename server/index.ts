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

function sizeForModel(model: ImageModel): "1024x1024" | "512x512" | "256x256" {
  if (model === "dall-e-2") return "1024x1024";
  return "1024x1024";
}

function costPlaceholder(model: ImageModel): {
  amount: number;
  currency: string;
  breakdown: { label: string; amount: number }[];
} {
  return {
    amount: 0,
    currency: "USD",
    breakdown: [{ label: `openai:${model}`, amount: 0 }],
  };
}

function safeSegment(id: string): string {
  return id.replace(/[^a-zA-Z0-9-_]/g, "_");
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

/** Serve generated stills and other `public/` files (same tree the render handler writes into). */
app.use(express.static(path.join(repoRoot, "public")));

app.post("/api/render-frame", async (req, res) => {
  try {
    const body = req.body as {
      projectId?: string;
      frameId?: string;
      prompt?: string;
      modelId?: string;
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
    const size = sizeForModel(model);

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
    const cost = costPlaceholder(model);

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
    const speech = await openai.audio.speech.create({
      model: "tts-1",
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
    res.json({ audioUrl });
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
