import { describe, expect, it } from "vitest";

import {
  createStoryBlock,
  markdownToStoryBlocks,
  storyBlocksToMarkdown,
  type StoryBlock,
} from "./storyMarkdown";

describe("story markdown blocks", () => {
  it("parses markdown lines into render-only story blocks", () => {
    const blocks = markdownToStoryBlocks(
      [
        "[HOOK — 0:00–0:20]",
        "",
        "[Upbeat, direct-to-camera]",
        "",
        "A short spoken line.",
        "",
        "— fade 0.4s",
      ].join("\n"),
    );

    expect(blocks).toEqual([
      {
        id: "block-0",
        type: "timestamp",
        title: "HOOK",
        start: "0:00",
        end: "0:20",
      },
      {
        id: "block-1",
        type: "prompt",
        text: "Upbeat, direct-to-camera",
      },
      {
        id: "block-2",
        type: "dialogue",
        text: "A short spoken line.",
      },
      {
        id: "block-3",
        type: "transition",
        transitionType: "fade",
        delay: "0.4",
      },
    ]);
  });

  it("serializes edited blocks back to markdown file content", () => {
    const blocks: StoryBlock[] = [
      { id: "a", type: "timestamp", title: "HOOK", start: "0:00", end: "0:20" },
      { id: "b", type: "prompt", text: "Upbeat, direct-to-camera" },
      { id: "c", type: "dialogue", text: "A short spoken line." },
      { id: "d", type: "transition", transitionType: "dissolve", delay: "0.5" },
    ];

    expect(storyBlocksToMarkdown(blocks)).toBe(
      "[HOOK — 0:00–0:20]\n\n[Upbeat, direct-to-camera]\n\nA short spoken line.\n\n⸻ dissolve 0.5s",
    );
  });

  it("creates every empty-state block type in markdown-compatible shape", () => {
    expect(storyBlocksToMarkdown([
      createStoryBlock("timestamp", "a"),
      createStoryBlock("prompt", "b"),
      createStoryBlock("dialogue", "c"),
      createStoryBlock("transition", "d"),
    ])).toBe("[SCENE — 0:00–0:10]\n\n[Visual direction]\n\nSpoken line.\n\n⸻");
  });
});
