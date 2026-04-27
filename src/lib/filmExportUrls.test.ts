import { describe, expect, it } from "vitest";

import { absolutizeFilmExportSegments } from "@/lib/filmExportUrls";
import type { FilmSegmentInput } from "@/lib/renderFilmTimeline";

const minimalSeg = (overrides: Partial<FilmSegmentInput> = {}): FilmSegmentInput => ({
  durationInFrames: 10,
  blank: true,
  sceneId: "s1",
  frameId: null,
  assetBundle: {
    id: "b1",
    name: "Kit",
    description: "",
    background: { color: "#000" },
    textStyles: [],
    characters: [],
    notes: "",
  },
  sceneTitle: "T",
  frameDescription: "",
  characters: [],
  plate: { color: "#111" },
  ...overrides,
});

describe("absolutizeFilmExportSegments", () => {
  it("prefixes root-relative still and background URLs", () => {
    const [out] = absolutizeFilmExportSegments(
      [
        minimalSeg({
          stillSrc: "/renders/pid/frame-1.png",
          plate: { color: "#000", src: "/uploads/plate.png" },
        }),
      ],
      "http://localhost:5173",
    );
    expect(out.stillSrc).toBe("http://localhost:5173/renders/pid/frame-1.png");
    expect(out.plate.src).toBe("http://localhost:5173/uploads/plate.png");
  });

  it("leaves data URLs unchanged", () => {
    const [out] = absolutizeFilmExportSegments(
      [minimalSeg({ stillSrc: "data:image/png;base64,xx" })],
      "http://localhost:5173",
    );
    expect(out.stillSrc).toBe("data:image/png;base64,xx");
  });
});
