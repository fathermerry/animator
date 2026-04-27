import { describe, expect, it } from "vitest";

import { buildNarrationExportClips } from "@/lib/filmNarrationExport";
import type { FilmSegmentInput } from "@/lib/renderFilmTimeline";

const baseSeg = (overrides: Partial<FilmSegmentInput>): FilmSegmentInput => ({
  durationInFrames: 10,
  blank: true,
  sceneId: "a",
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

describe("buildNarrationExportClips", () => {
  it("merges same-scene segments and maps narration", () => {
    const segs: FilmSegmentInput[] = [
      baseSeg({ sceneId: "s1", durationInFrames: 30, frameId: "f1" }),
      baseSeg({ sceneId: "s1", durationInFrames: 20, frameId: "f2" }),
      baseSeg({ sceneId: "s2", durationInFrames: 15, frameId: "f3" }),
    ];
    const clips = buildNarrationExportClips(segs, [
      { id: "s1", narrationAudioSrc: "/r/a.mp3" },
      { id: "s2", narrationAudioSrc: "/r/b.mp3" },
    ]);
    expect(clips).toEqual([
      { durationInFrames: 50, src: "/r/a.mp3" },
      { durationInFrames: 15, src: "/r/b.mp3" },
    ]);
  });
});
