import { describe, expect, it } from "vitest";

import { buildSceneVoiceoverSrt, formatSrtTimestamp, type SceneSrtInput } from "@/lib/buildFilmSrt";

describe("formatSrtTimestamp", () => {
  it("formats zero and subsecond", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    expect(formatSrtTimestamp(1.5)).toBe("00:00:01,500");
  });
});

describe("buildSceneVoiceoverSrt", () => {
  it("emits one cue per scene in index order with voiceover text", () => {
    const scenes: SceneSrtInput[] = [
      {
        id: "a",
        index: 0,
        durationSeconds: 2,
        title: "A",
        voiceoverText: "First line",
        description: "d1",
      },
      {
        id: "b",
        index: 1,
        durationSeconds: 3,
        title: "B",
        voiceoverText: "Second",
        description: "d2",
      },
    ];
    const srt = buildSceneVoiceoverSrt(scenes);
    expect(srt).toContain("00:00:00,000 --> 00:00:02,000");
    expect(srt).toContain("First line");
    expect(srt).toContain("00:00:02,000 --> 00:00:05,000");
    expect(srt).toContain("Second");
  });
});
