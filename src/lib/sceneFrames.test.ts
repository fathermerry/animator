import { describe, expect, it } from "vitest";

import { framesForSceneSorted } from "@/lib/sceneFrames";
import type { Frame } from "@/types/project";

function frame(partial: Partial<Frame> & Pick<Frame, "id" | "sceneId" | "index">): Frame {
  return {
    projectId: "p1",
    renderId: "r1",
    src: "",
    description: "",
    ...partial,
  } as Frame;
}

describe("framesForSceneSorted", () => {
  it("filters by sceneId and sorts by index ascending", () => {
    const frames = [
      frame({ id: "f2", sceneId: "A", index: 2 }),
      frame({ id: "f0", sceneId: "A", index: 0 }),
      frame({ id: "f1", sceneId: "A", index: 1 }),
      frame({ id: "other", sceneId: "B", index: 0 }),
    ];
    const sorted = framesForSceneSorted(frames, "A");
    expect(sorted.map((f) => f.id)).toEqual(["f0", "f1", "f2"]);
  });

  it("does not mutate the original array order", () => {
    const frames = [frame({ id: "b", sceneId: "S", index: 1 }), frame({ id: "a", sceneId: "S", index: 0 })];
    const copy = [...frames];
    framesForSceneSorted(frames, "S");
    expect(frames).toEqual(copy);
  });
});
