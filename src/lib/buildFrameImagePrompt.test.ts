import { describe, expect, it } from "vitest";

import {
  OPENAI_IMAGE_PROMPT_MAX_CHARS,
  buildFrameImageContext,
  buildFrameImagePrompt,
  frameImagePromptFromContext,
  truncateTailWithNote,
} from "@/lib/buildFrameImagePrompt";
import type { Frame, Project, Scene } from "@/types/project";
import { createDefaultAssetBundle } from "@/types/styleConfig";

function baseScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "scene-1",
    projectId: "proj-1",
    index: 0,
    title: "Opening",
    description: "Hero walks in.",
    voiceoverText: "",
    characterIds: [],
    durationSeconds: 8,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function baseFrame(overrides: Partial<Frame> = {}): Frame {
  return {
    id: "frame-1",
    projectId: "proj-1",
    sceneId: "scene-1",
    renderId: "render-1",
    index: 0,
    src: "",
    description: "Wide establishing shot.",
    ...overrides,
  };
}

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Film",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    prompt: "",
    styleConfigId: "style-1",
    ...overrides,
  };
}

describe("truncateTailWithNote", () => {
  it("returns the string unchanged when under the cap", () => {
    expect(truncateTailWithNote("hello", 10)).toBe("hello");
  });

  it("appends [Truncated] and stays within max length", () => {
    const max = 4000;
    const long = "a".repeat(5000);
    const out = truncateTailWithNote(long, max);
    expect(out.length).toBeLessThanOrEqual(max);
    expect(out.endsWith("\n[Truncated]")).toBe(true);
  });
});

describe("frameImagePromptFromContext", () => {
  it("includes scene title, beat, frame staging, and background hint", () => {
    const bundle = createDefaultAssetBundle();
    const ctx = buildFrameImageContext(baseScene(), baseFrame(), bundle);
    const prompt = frameImagePromptFromContext(ctx);
    expect(prompt).toContain("Opening");
    expect(prompt).toContain("Hero walks in.");
    expect(prompt).toContain("Wide establishing shot.");
    expect(prompt).toContain("Background plate color hint:");
  });

  it("lists selected kit characters by name and id", () => {
    const bundle = createDefaultAssetBundle();
    const first = bundle.characters[0];
    expect(first).toBeDefined();
    const ctx = buildFrameImageContext(
      baseScene({ characterIds: [first!.id] }),
      baseFrame(),
      bundle,
    );
    const prompt = frameImagePromptFromContext(ctx);
    expect(prompt).toContain(first!.name);
    expect(prompt).toContain(`(${first!.id})`);
  });
});

describe("buildFrameImagePrompt", () => {
  it("omits the overall brief section when project.prompt is empty", () => {
    const bundle = createDefaultAssetBundle();
    const out = buildFrameImagePrompt(baseProject({ prompt: "" }), baseScene(), baseFrame(), bundle);
    expect(out).not.toContain("## Overall video brief");
    expect(out.length).toBeLessThanOrEqual(OPENAI_IMAGE_PROMPT_MAX_CHARS);
  });

  it("prepends the overall brief when it fits under the cap with the body", () => {
    const bundle = createDefaultAssetBundle();
    const brief = "Keep pacing tight and visuals clean.";
    const out = buildFrameImagePrompt(baseProject({ prompt: brief }), baseScene(), baseFrame(), bundle);
    expect(out.startsWith("## Overall video brief\n\n")).toBe(true);
    expect(out).toContain(brief);
    expect(out).toContain("## Scene");
    expect(out.length).toBeLessThanOrEqual(OPENAI_IMAGE_PROMPT_MAX_CHARS);
  });

  it("truncates the brief with an ellipsis when only part of the brief fits", () => {
    const bundle = createDefaultAssetBundle();
    const body = frameImagePromptFromContext(buildFrameImageContext(baseScene(), baseFrame(), bundle));
    const intro = "## Overall video brief\n\n";
    const sep = "\n\n";
    const overhead = intro.length + sep.length;
    const room = OPENAI_IMAGE_PROMPT_MAX_CHARS - overhead - body.length;
    expect(room).toBeGreaterThan(0);
    const brief = `${"B".repeat(Math.max(0, room - 1))}EXTRA_TAIL`;
    const out = buildFrameImagePrompt(baseProject({ prompt: brief }), baseScene(), baseFrame(), bundle);
    expect(out).toContain("…");
    expect(out).not.toContain("EXTRA_TAIL");
    expect(out.length).toBeLessThanOrEqual(OPENAI_IMAGE_PROMPT_MAX_CHARS);
  });

  it("drops the brief and only truncates the body when the body alone exceeds the budget for a combined layout", () => {
    const bundle = createDefaultAssetBundle();
    const padding = "word ".repeat(2000);
    const scene = baseScene({ description: padding });
    const frame = baseFrame({ description: padding });
    const out = buildFrameImagePrompt(baseProject({ prompt: "short" }), scene, frame, bundle);
    expect(out).not.toContain("## Overall video brief");
    expect(out.length).toBeLessThanOrEqual(OPENAI_IMAGE_PROMPT_MAX_CHARS);
    expect(out.endsWith("\n[Truncated]")).toBe(true);
  });
});
