# Animator

An AI-powered animation tool for composing short films scene by scene. You write the story, define the visual style, and AI generates the imagery — Animator assembles it into a playable film.

## What it does

Animator guides you through a three-step workflow to produce an animated film:

1. **Story** — Write scenes with voiceover narration. Each scene has a script, and the app uses OpenAI TTS to generate the narration audio.
2. **Style** — Define the visual language: a style description, typography, and a character/prop kit. Each kit asset can be generated as an image, giving the AI a reference to keep characters consistent across frames.
3. **Compose** — Break each scene into individual frames, write staging notes, and generate frame images using OpenAI image models. A Remotion player previews the full film with narration synced to each scene's duration.

Projects are persisted locally in IndexedDB. Generated images and audio are saved to disk in `public/renders/`.

## Page structure

```
#/projects                     Home — list and open projects

#{projectId}/story             Step 1: Scene editor
                               - Add/reorder scenes
                               - Write voiceover text and generate narration audio
                               - Set scene duration from audio length

#{projectId}/style             Step 2: Visual style kit
                               - Global style description (mood, palette, rendering style)
                               - Typography presets
                               - Character and prop library with per-asset image generation
                               - Scene reference image generation (one image per scene)

#{projectId}/compose           Step 3: Frame composer
                               - Per-frame staging controls (title, description, character selection)
                               - Generate frame images with the selected AI image model
                               - Full-film Remotion player (1920×1080, 24fps) with narration
                               - Abort/retry individual frame renders

#/renders                      Cost overview — render history and accumulated spend
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI |
| State | Zustand |
| Video | Remotion 4 |
| Backend | Express 5, Node.js |
| AI — images | OpenAI Images API (`gpt-image-1`, `dall-e-3`, `dall-e-2`) |
| AI — audio | OpenAI TTS API (`tts-1`, voice: alloy) |
| Storage | IndexedDB (projects), local disk (renders) |

## How AI is used

**Image generation** — When you click Generate on a frame or kit asset, the app builds a structured prompt from your style description, scene context, and character details, then calls `/api/render-frame` on the Express server. The server calls `openai.images.generate()` and saves the result to `public/renders/{projectId}/`.

**Prompt assembly** lives in:
- [`src/lib/buildFrameImagePrompt.ts`](src/lib/buildFrameImagePrompt.ts) — scene frames
- [`src/lib/buildSceneReferenceImagePrompt.ts`](src/lib/buildSceneReferenceImagePrompt.ts) — style-step reference images
- [`src/lib/buildKitAssetImagePrompt.ts`](src/lib/buildKitAssetImagePrompt.ts) — character/prop kit images

**Narration generation** — Scene voiceover text is sent to `/api/narration`, which calls `openai.audio.speech.create()` and saves an MP3. The client measures the audio duration to set each scene's length in the Remotion timeline.

**Cost tracking** — Every API call records a cost estimate. The `#/renders` page and a floating dock show accumulated spend per session.

## Running locally

```bash
# Install dependencies
npm install

# Set your OpenAI API key
export OPENAI_API_KEY=sk-...

# Start Vite dev server + Express API together
npm run dev
```

The Vite frontend runs on port 5173 and the Express server on port 3001 by default.
