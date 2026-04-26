import { describe, expect, it } from "vitest";

import {
  filmDurationSeconds,
  formatDurationMmSs,
  formatFilmSegmentClock,
  formatFilmTime,
  getStoryNarrationPlaybackAtGlobalSeconds,
  parseDurationMmSsInput,
  sceneStartSeconds,
} from "@/lib/filmTime";
import type { Scene } from "@/types/project";

function scene(partial: Partial<Scene> & Pick<Scene, "id" | "index">): Scene {
  return {
    projectId: "p1",
    title: "T",
    description: "",
    voiceoverText: "",
    characterIds: [],
    durationSeconds: 10,
    createdAt: new Date(),
    ...partial,
  } as Scene;
}

describe("parseDurationMmSsInput", () => {
  it("treats empty string as 0 seconds", () => {
    expect(parseDurationMmSsInput("")).toBe(0);
    expect(parseDurationMmSsInput("   ")).toBe(0);
  });

  it("parses m:ss and plain seconds", () => {
    expect(parseDurationMmSsInput("1:05")).toBe(65);
    expect(parseDurationMmSsInput("90")).toBe(90);
  });

  it("clamps seconds in m:ss to 59", () => {
    expect(parseDurationMmSsInput("0:99")).toBe(59);
  });

  it("returns null for invalid input", () => {
    expect(parseDurationMmSsInput("1:x")).toBeNull();
    expect(parseDurationMmSsInput("1:2:3")).toBeNull();
    expect(parseDurationMmSsInput("abc")).toBeNull();
  });
});

describe("formatDurationMmSs", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatDurationMmSs(65)).toBe("1:05");
    expect(formatDurationMmSs(0)).toBe("0:00");
  });
});

describe("formatFilmTime", () => {
  it("returns two decimal places and floors negatives via max", () => {
    expect(formatFilmTime(12.345)).toBe("12.35");
    expect(formatFilmTime(Number.NaN)).toBe("0.00");
  });
});

describe("formatFilmSegmentClock", () => {
  it("shows fractional seconds and pads the clock segment", () => {
    expect(formatFilmSegmentClock(65.5)).toMatch(/^1:05\.50$/);
  });

  it("handles non-finite values", () => {
    expect(formatFilmSegmentClock(Number.NaN)).toBe("0:00.00");
  });
});

describe("sceneStartSeconds", () => {
  it("sums durations of prior scenes ordered by index", () => {
    const scenes = [
      scene({ id: "a", index: 1, durationSeconds: 5 }),
      scene({ id: "b", index: 0, durationSeconds: 3 }),
      scene({ id: "c", index: 2, durationSeconds: 2 }),
    ];
    expect(sceneStartSeconds(scenes, "b")).toBe(0);
    expect(sceneStartSeconds(scenes, "a")).toBe(3);
    expect(sceneStartSeconds(scenes, "c")).toBe(8);
  });

  it("returns 0 for unknown scene id", () => {
    const scenes = [scene({ id: "a", index: 0, durationSeconds: 1 })];
    expect(sceneStartSeconds(scenes, "missing")).toBe(0);
  });
});

describe("getStoryNarrationPlaybackAtGlobalSeconds", () => {
  it("returns null when there are no scenes or zero total duration", () => {
    expect(getStoryNarrationPlaybackAtGlobalSeconds(0, [])).toBeNull();
    expect(
      getStoryNarrationPlaybackAtGlobalSeconds(0, [scene({ id: "a", index: 0, durationSeconds: 0 })]),
    ).toBeNull();
  });

  it("maps global time to the active scene and narration src", () => {
    const scenes = [
      scene({
        id: "s1",
        index: 0,
        durationSeconds: 10,
        narrationAudioSrc: "/renders/p/n1.mp3",
      }),
      scene({ id: "s2", index: 1, durationSeconds: 5 }),
    ];
    const mid = getStoryNarrationPlaybackAtGlobalSeconds(5, scenes);
    expect(mid).toEqual({
      sceneId: "s1",
      elapsedInSceneSeconds: 5,
      sceneDurationSeconds: 10,
      narrationSrc: "/renders/p/n1.mp3",
    });
  });

  it("clamps global time to the film end", () => {
    const scenes = [scene({ id: "s1", index: 0, durationSeconds: 4 })];
    const end = getStoryNarrationPlaybackAtGlobalSeconds(100, scenes);
    expect(end?.sceneId).toBe("s1");
    expect(end?.elapsedInSceneSeconds).toBe(4);
  });
});

describe("filmDurationSeconds", () => {
  it("sums scene durations", () => {
    const scenes = [
      scene({ id: "a", index: 0, durationSeconds: 2 }),
      scene({ id: "b", index: 1, durationSeconds: 3 }),
    ];
    expect(filmDurationSeconds(scenes)).toBe(5);
  });
});
