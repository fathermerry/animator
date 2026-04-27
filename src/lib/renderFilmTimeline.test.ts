import { describe, expect, it } from "vitest";

import { FILM_FPS, buildRenderFilmTimeline, getFilmTimingByProjectFrameId } from "@/lib/renderFilmTimeline";
import type { Frame, Render, Scene } from "@/types/project";
import { createDefaultAssetBundle } from "@/types/styleConfig";

const baseCost = { amount: 0, currency: "USD" as const, breakdown: [] };

function mkScene(partial: Partial<Scene> & Pick<Scene, "id" | "index">): Scene {
  return {
    projectId: "p1",
    title: "Scene",
    description: "Scene beat copy.",
    voiceoverText: "",
    characterIds: [],
    durationSeconds: 6,
    createdAt: new Date(),
    ...partial,
  } as Scene;
}

function mkFrame(partial: Partial<Frame> & Pick<Frame, "id" | "sceneId" | "index" | "renderId">): Frame {
  return {
    projectId: "p1",
    src: "/renders/p1/still.png",
    description: "Frame staging",
    ...partial,
  } as Frame;
}

function mkRender(partial: Partial<Render> & Pick<Render, "id" | "sceneId">): Render {
  return {
    projectId: "p1",
    type: "frame",
    engine: "openai-image",
    status: "complete",
    cost: baseCost,
    createdAt: new Date(),
    ...partial,
  } as Render;
}

describe("buildRenderFilmTimeline", () => {
  const bundle = createDefaultAssetBundle();

  it("ignores delaySeconds (no leading delay-only segment)", () => {
    const scene = mkScene({
      id: "s1",
      index: 0,
      delaySeconds: 1,
      durationSeconds: 2,
    });
    const frame = mkFrame({
      id: "f1",
      sceneId: "s1",
      index: 0,
      renderId: "r1",
    });
    const renders = [mkRender({ id: "r1", sceneId: "s1" })];
    const { segments } = buildRenderFilmTimeline([scene], [frame], renders, bundle);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      frameId: "f1",
      blank: false,
    });
  });

  it("uses a single blank segment with the scene beat when the scene has no frames", () => {
    const scene = mkScene({ id: "s1", index: 0, durationSeconds: 2 });
    const { segments, totalFrames } = buildRenderFilmTimeline([scene], [], [], bundle);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      blank: true,
      frameId: null,
      frameDescription: "Scene beat copy.",
      durationInFrames: Math.round(2 * FILM_FPS),
    });
    expect(totalFrames).toBe(segments[0]!.durationInFrames);
  });

  it("splits scene duration across frames and marks blank until a frame is generated", () => {
    const scene = mkScene({ id: "s1", index: 0, durationSeconds: 6 });
    const frames = [
      mkFrame({ id: "a", sceneId: "s1", index: 0, renderId: "r0", src: "/ok.png" }),
      mkFrame({ id: "b", sceneId: "s1", index: 1, renderId: "r1", src: "" }),
    ];
    const renders = [
      mkRender({ id: "r0", sceneId: "s1", status: "complete" }),
      mkRender({ id: "r1", sceneId: "s1", status: "complete" }),
    ];
    const { segments } = buildRenderFilmTimeline([scene], frames, renders, bundle);
    const frameSegs = segments.filter((s) => s.frameId != null);
    expect(frameSegs).toHaveLength(2);
    expect(frameSegs[0]!.blank).toBe(false);
    expect(frameSegs[0]!.stillSrc).toBe("/ok.png");
    expect(frameSegs[1]!.blank).toBe(true);
    expect(frameSegs[1]!.stillSrc).toBeNull();
    const sum = segments.reduce((acc, s) => acc + s.durationInFrames, 0);
    expect(sum).toBe(Math.round(6 * FILM_FPS));
  });

  it("respects explicit per-frame durationSeconds when splitting", () => {
    const scene = mkScene({ id: "s1", index: 0, durationSeconds: 6 });
    const frames = [
      mkFrame({
        id: "a",
        sceneId: "s1",
        index: 0,
        renderId: "r0",
        durationSeconds: 2,
        src: "/a.png",
      }),
      mkFrame({ id: "b", sceneId: "s1", index: 1, renderId: "r1", src: "/b.png" }),
    ];
    const renders = [
      mkRender({ id: "r0", sceneId: "s1", status: "complete" }),
      mkRender({ id: "r1", sceneId: "s1", status: "complete" }),
    ];
    const { segments } = buildRenderFilmTimeline([scene], frames, renders, bundle);
    const byId = new Map(segments.filter((s) => s.frameId).map((s) => [s.frameId!, s]));
    expect(byId.get("a")!.durationInFrames).toBe(Math.round(2 * FILM_FPS));
    expect(byId.get("b")!.durationInFrames).toBe(Math.round(4 * FILM_FPS));
  });
});

describe("getFilmTimingByProjectFrameId", () => {
  it("matches segment starts from buildRenderFilmTimeline", () => {
    const bundle = createDefaultAssetBundle();
    const scene = mkScene({ id: "s1", index: 0, durationSeconds: 4 });
    const frames = [
      mkFrame({ id: "a", sceneId: "s1", index: 0, renderId: "r0", src: "/a.png" }),
      mkFrame({ id: "b", sceneId: "s1", index: 1, renderId: "r1", src: "/b.png" }),
    ];
    const renders = [
      mkRender({ id: "r0", sceneId: "s1", status: "complete" }),
      mkRender({ id: "r1", sceneId: "s1", status: "complete" }),
    ];
    const timing = getFilmTimingByProjectFrameId([scene], frames, renders, bundle);
    expect(timing.get("a")!.startSeconds).toBe(0);
    expect(timing.get("b")!.startSeconds).toBeCloseTo(timing.get("a")!.durationSeconds, 5);
  });
});
