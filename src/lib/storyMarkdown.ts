export type TransitionType = "cut" | "fade" | "dissolve";

export type TimestampBlock = {
  id: string;
  type: "timestamp";
  title: string;
  start: string;
  end: string;
};

export type PromptBlock = {
  id: string;
  type: "prompt";
  text: string;
};

export type DialogueBlock = {
  id: string;
  type: "dialogue";
  text: string;
};

export type TransitionBlock = {
  id: string;
  type: "transition";
  transitionType: TransitionType;
  delay: string;
};

export type StoryBlock = TimestampBlock | PromptBlock | DialogueBlock | TransitionBlock;
export type StoryBlockType = StoryBlock["type"];

export const TRANSITION_TYPES: TransitionType[] = ["cut", "fade", "dissolve"];
export const STORY_BLOCK_TYPES: StoryBlockType[] = ["timestamp", "prompt", "dialogue", "transition"];

export function createStoryBlock(type: StoryBlockType, id: string): StoryBlock {
  if (type === "timestamp") {
    return {
      id,
      type,
      title: "SCENE",
      start: "0:00",
      end: "0:10",
    };
  }
  if (type === "prompt") {
    return {
      id,
      type,
      text: "Visual direction",
    };
  }
  if (type === "transition") {
    return {
      id,
      type,
      transitionType: "cut",
      delay: "0",
    };
  }
  return {
    id,
    type,
    text: "Spoken line.",
  };
}

const TIMESTAMP_RE = /^\[(.+?)\s*[—-]\s*([0-9][0-9:.]*)\s*[–-]\s*([0-9][0-9:.]*)\]$/;
const TRANSITION_RE = /^(?:⸻|---|--|—|-)(?:\s+([a-z]+))?(?:\s+([0-9.]+s?))?$/i;

export function markdownToStoryBlocks(markdown: string): StoryBlock[] {
  const lines = markdown.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line, index) => {
    const trimmed = line.trim();
    const timestampMatch = trimmed.match(TIMESTAMP_RE);
    if (timestampMatch) {
      return {
        id: `block-${index}`,
        type: "timestamp",
        title: timestampMatch[1]?.trim() || "Scene",
        start: timestampMatch[2]?.trim() || "0:00",
        end: timestampMatch[3]?.trim() || "0:00",
      };
    }

    const transitionMatch = trimmed.match(TRANSITION_RE);
    if (transitionMatch) {
      const transitionType = TRANSITION_TYPES.includes(transitionMatch[1] as TransitionType)
        ? (transitionMatch[1] as TransitionType)
        : "cut";
      return {
        id: `block-${index}`,
        type: "transition",
        transitionType,
        delay: transitionMatch[2]?.replace(/s$/i, "") || "0",
      };
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      return {
        id: `block-${index}`,
        type: "prompt",
        text: trimmed.slice(1, -1).trim(),
      };
    }

    return {
      id: `block-${index}`,
      type: "dialogue",
      text: line.trim(),
    };
  });
}

export function storyBlocksToMarkdown(blocks: StoryBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "timestamp") return `[${block.title} — ${block.start}–${block.end}]`;
      if (block.type === "prompt") return `[${block.text}]`;
      if (block.type === "transition") {
        const delay = Number.parseFloat(block.delay);
        const suffix = Number.isFinite(delay) && delay > 0 ? ` ${block.transitionType} ${delay}s` : "";
        return `⸻${suffix}`;
      }
      return block.text;
    })
    .join("\n\n");
}
