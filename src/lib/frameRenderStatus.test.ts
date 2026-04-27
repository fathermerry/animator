import { describe, expect, it } from "vitest";

import { findRender, isFrameGeneratedForPreview } from "@/lib/frameRenderStatus";
import type { Frame, Render } from "@/types/project";

const baseCost = { amount: 0, currency: "USD" as const, breakdown: [] };

function render(partial: Partial<Render> & Pick<Render, "id">): Render {
  return {
    projectId: "p1",
    sceneId: "s1",
    type: "frame",
    engine: "openai-image",
    status: "complete",
    cost: baseCost,
    createdAt: new Date(),
    target: { type: "image", name: "T", provider: "openai" },
    ...partial,
  } as Render;
}

function frame(partial: Partial<Frame> & Pick<Frame, "id" | "renderId">): Frame {
  return {
    projectId: "p1",
    sceneId: "s1",
    index: 0,
    src: "/renders/p/out.png",
    description: "",
    ...partial,
  } as Frame;
}

describe("findRender", () => {
  it("returns the render matching frame.renderId with type frame", () => {
    const r = render({ id: "r1" });
    const f = frame({ id: "f1", renderId: "r1" });
    expect(
      findRender(
        [r, render({ id: "r2", type: "narration", target: { type: "audio", name: "N", provider: "openai" } })],
        f,
      ),
    ).toEqual(r);
  });

  it("returns undefined when no frame render matches", () => {
    const f = frame({ id: "f1", renderId: "missing" });
    expect(findRender([render({ id: "r1" })], f)).toBeUndefined();
  });

  it("ignores renders with non-frame type even when ids match", () => {
    const r = render({ id: "r1", type: "narration", target: { type: "audio", name: "N", provider: "openai" } });
    const f = frame({ id: "f1", renderId: "r1" });
    expect(findRender([r], f)).toBeUndefined();
  });
});

describe("isFrameGeneratedForPreview", () => {
  it("is false when render is missing, not complete, or src is empty/placeholder", () => {
    const f = frame({ id: "f1", renderId: "r1", src: "/foo.png" });
    expect(isFrameGeneratedForPreview(f, [])).toBe(false);
    expect(isFrameGeneratedForPreview(f, [render({ id: "r1", status: "pending" })])).toBe(false);
    expect(
      isFrameGeneratedForPreview(frame({ id: "f1", renderId: "r1", src: "" }), [render({ id: "r1" })]),
    ).toBe(false);
    expect(
      isFrameGeneratedForPreview(frame({ id: "f1", renderId: "r1", src: "/kit/placeholder.png" }), [
        render({ id: "r1" }),
      ]),
    ).toBe(false);
  });

  it("is true when the frame render is complete and src is a real still", () => {
    const f = frame({ id: "f1", renderId: "r1", src: "/renders/p/still.png" });
    const renders = [render({ id: "r1", status: "complete" })];
    expect(isFrameGeneratedForPreview(f, renders)).toBe(true);
  });
});
