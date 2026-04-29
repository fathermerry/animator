import {
  ArrowUp,
  ChevronDown,
  Clock3,
  Clapperboard,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TRANSITION_TYPES,
  createStoryBlock,
  markdownToStoryBlocks,
  storyBlocksToMarkdown,
  type StoryBlock,
  type StoryBlockType,
  type TransitionType,
} from "@/lib/storyMarkdown";
import { cn } from "@/lib/utils";
import { useStoryNextContext } from "@/context/StoryNextProvider";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";

type AiActionState = "idle" | "working";

const EMPTY_BLOCK_ACTIONS: {
  type: StoryBlockType;
  label: string;
  description: string;
  icon: typeof Clock3;
}[] = [
  {
    type: "timestamp",
    label: "Timestamp",
    description: "Scene title and time range",
    icon: Clock3,
  },
  {
    type: "prompt",
    label: "Direction",
    description: "Bracketed visual or performance note",
    icon: Clapperboard,
  },
  {
    type: "dialogue",
    label: "Dialogue",
    description: "Narration or spoken line",
    icon: MessageSquareText,
  },
  {
    type: "transition",
    label: "Transition",
    description: "Separator with optional timing",
    icon: WandSparkles,
  },
];

const NEW_STORY_COMMAND_RE =
  /^(?:start over|new story|start a new story|write a new story|create a new story|make a new story|replace (?:this|the) story|change (?:this|the) story to be about)\b/i;

function shouldStartNewStory(command: string): boolean {
  return NEW_STORY_COMMAND_RE.test(command.trim());
}

function buildStoryUpdatePrompt(currentStory: string, command: string): string {
  return [
    "Update the existing markdown story using the requested change.",
    "Keep the same markdown story block grammar.",
    "Preserve details that the request does not change.",
    "",
    "Existing story markdown:",
    currentStory.trim(),
    "",
    "Requested change:",
    command.trim(),
  ].join("\n");
}

export function StoryPageView() {
  const project = useStore(useProjectStore, selectCurrentProject);
  const setPromptText = useStore(useProjectStore, (s) => s.setPromptText);
  const requestScriptGeneration = useStore(useProjectStore, (s) => s.requestScriptGeneration);
  const { flowError } = useStoryNextContext();

  const blocks = useMemo(() => markdownToStoryBlocks(project.prompt), [project.prompt]);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiActionState, setAiActionState] = useState<AiActionState>("idle");
  const [aiError, setAiError] = useState("");
  const [emptyAddOpen, setEmptyAddOpen] = useState(false);
  const [insertMenuIndex, setInsertMenuIndex] = useState<number | null>(null);
  const aiWorking = aiActionState === "working";

  const writeBlocks = useCallback(
    (nextBlocks: StoryBlock[]) => {
      setPromptText(storyBlocksToMarkdown(nextBlocks));
    },
    [setPromptText],
  );

  const patchBlock = useCallback(
    (blockId: string, patch: Partial<StoryBlock>) => {
      const next = blocks.map((block) => (block.id === blockId ? ({ ...block, ...patch } as StoryBlock) : block));
      writeBlocks(next);
    },
    [blocks, writeBlocks],
  );

  const addInitialBlock = useCallback(
    (type: StoryBlockType) => {
      const blockId = "block-0";
      writeBlocks([createStoryBlock(type, blockId)]);
      setEditingBlockId(blockId);
      setEmptyAddOpen(false);
    },
    [writeBlocks],
  );

  const insertBlockAt = useCallback(
    (index: number, type: StoryBlockType) => {
      const blockId = `block-${index}`;
      const next = [
        ...blocks.slice(0, index),
        createStoryBlock(type, blockId),
        ...blocks.slice(index),
      ];
      writeBlocks(next);
      setEditingBlockId(blockId);
      setInsertMenuIndex(null);
      setAiActionState("idle");
    },
    [blocks, writeBlocks],
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      const next = blocks.filter((block) => block.id !== blockId);
      writeBlocks(next);
      if (editingBlockId === blockId) setEditingBlockId(null);
    },
    [blocks, editingBlockId, writeBlocks],
  );

  const generateStoryFromDescription = useCallback(
    async (description: string) => {
      const story = description.trim();
      if (!story || aiWorking) return;

      setAiError("");
      setAiActionState("working");
      try {
        await requestScriptGeneration(story);
        setAiInput("");
      } catch (e: unknown) {
        setAiError(e instanceof Error ? e.message : "Story generation failed.");
      } finally {
        setAiActionState("idle");
      }
    },
    [aiWorking, requestScriptGeneration],
  );

  const runAiEdit = useCallback(async () => {
    const command = aiInput.trim();
    if (!command || aiWorking) return;

    if (blocks.length === 0 || shouldStartNewStory(command)) {
      await generateStoryFromDescription(command);
      return;
    }

    setAiError("");
    setAiActionState("working");
    try {
      await requestScriptGeneration(buildStoryUpdatePrompt(project.prompt, command));
      setAiInput("");
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Story update failed.");
    } finally {
      setAiActionState("idle");
    }
  }, [
    aiWorking,
    aiInput,
    blocks.length,
    generateStoryFromDescription,
    project.prompt,
    requestScriptGeneration,
  ]);

  return (
    <div className="flex w-full min-w-0 flex-col">
      {flowError ? (
        <div className="sticky top-0 z-10 shrink-0 border-b border-border/50 bg-background/90 px-4 py-2 backdrop-blur sm:px-6">
          <p className="min-w-0 text-sm text-destructive" role="alert">
            {flowError}
          </p>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-3xl px-4 pb-40 pt-3 md:px-8 md:pb-44 md:pt-5">
        <div className="flex flex-col">
          {blocks.length > 0 ? (
            <>
              {blocks.map((block, index) => (
                <div key={block.id} className="flex flex-col">
                  <StoryBlockRow
                    block={block}
                    changed={false}
                    editing={editingBlockId === block.id}
                    onEdit={() => setEditingBlockId(block.id)}
                    onDone={() => setEditingBlockId(null)}
                    onPatch={(patch) => patchBlock(block.id, patch)}
                    onRemove={() => removeBlock(block.id)}
                  />
                  {index < blocks.length - 1 ? (
                    <AddStepControl
                      open={insertMenuIndex === index + 1}
                      revealOnHover
                      onAddBlock={(type) => insertBlockAt(index + 1, type)}
                      onToggle={() => setInsertMenuIndex((current) => (current === index + 1 ? null : index + 1))}
                    />
                  ) : null}
                </div>
              ))}
            </>
          ) : (
            <EmptyStoryState
              addOpen={emptyAddOpen}
              onAddBlock={addInitialBlock}
              onToggleAdd={() => setEmptyAddOpen((open) => !open)}
            />
          )}
        </div>
      </main>

      <div className="fixed bottom-5 left-1/2 z-30 w-[min(calc(100vw-2rem),38rem)] -translate-x-1/2">
        <section className="overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
          <div className="flex items-end gap-1.5 p-2.5">
            <Textarea
              value={aiInput}
              onChange={(e) => {
                setAiInput(e.target.value);
                if (aiError) setAiError("");
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                void runAiEdit();
              }}
              rows={1}
              placeholder={
                aiError || (blocks.length === 0 ? "Describe a story to generate" : "Start a new story or edit this one")
              }
              disabled={aiWorking}
              aria-label="Script change request"
              className="min-h-9 max-h-40 resize-none border-0 bg-transparent px-3 py-2 text-base leading-snug shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Button
              type="button"
              size="icon"
              className="size-9 shrink-0 cursor-pointer rounded-full bg-foreground text-background shadow-none hover:bg-foreground/90 disabled:bg-muted-foreground/30 disabled:text-background/70"
              onClick={() => void runAiEdit()}
              disabled={!aiInput.trim() || aiWorking}
              aria-label="Send script change request"
            >
              {aiWorking ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="size-5" aria-hidden />
              )}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

type AddStepControlProps = {
  addOpen: boolean;
  onAddBlock: (type: StoryBlockType) => void;
  onToggleAdd: () => void;
};

function EmptyStoryState(props: AddStepControlProps) {
  return <AddStepControl open={props.addOpen} onAddBlock={props.onAddBlock} onToggle={props.onToggleAdd} />;
}

function AddStepControl({
  open,
  revealOnHover = false,
  onAddBlock,
  onToggle,
}: {
  open: boolean;
  revealOnHover?: boolean;
  onAddBlock: (type: StoryBlockType) => void;
  onToggle: () => void;
}) {
  return (
    <div className={cn("group/insert grid py-1", revealOnHover && "py-0")}>
      <div className="relative w-full">
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-9 w-full justify-between rounded-md border border-dashed border-transparent bg-transparent px-3 text-muted-foreground/70 hover:border-border hover:bg-muted/20 hover:text-foreground",
            revealOnHover && !open && "h-4 opacity-0 transition-all group-hover/insert:h-9 group-hover/insert:opacity-100 focus-visible:h-9 focus-visible:opacity-100",
            open && "border-border bg-muted/20 text-foreground",
          )}
          onClick={onToggle}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Plus className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Add step</span>
          </span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </Button>

        {open ? (
          <StoryBlockTypeMenu
            className="absolute left-0 top-10 z-20 w-full"
            onAddBlock={onAddBlock}
          />
        ) : null}
      </div>
    </div>
  );
}

function StoryBlockTypeMenu({
  className,
  onAddBlock,
}: {
  className?: string;
  onAddBlock: (type: StoryBlockType) => void;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-md border border-border bg-popover shadow-xl", className)}
      role="menu"
    >
      {EMPTY_BLOCK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.type}
            type="button"
            className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 px-4 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            onClick={() => onAddBlock(action.type)}
            role="menuitem"
          >
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{action.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{action.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StoryBlockRow({
  block,
  changed,
  editing,
  onEdit,
  onDone,
  onPatch,
  onRemove,
}: {
  block: StoryBlock;
  changed: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onPatch: (patch: Partial<StoryBlock>) => void;
  onRemove: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;

    const onPointerDown = (e: PointerEvent) => {
      const node = rowRef.current;
      if (!node || node.contains(e.target as Node)) return;
      onDone();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDone();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [editing, onDone]);

  return (
    <div
      ref={rowRef}
      className={cn(
        "group relative rounded-md border px-3 py-2 transition-colors",
        changed ? "border-foreground bg-muted/45" : "border-transparent hover:border-border hover:bg-muted/20",
      )}
    >
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_1.75rem] gap-3",
          editing || block.type === "dialogue" ? "items-start" : "items-center",
        )}
      >
        <div className="min-w-0 flex-1">
          {editing ? (
            <BlockEditor block={block} onPatch={onPatch} />
          ) : (
            <button
              type="button"
              className="block w-full min-w-0 cursor-text text-left"
              onClick={onEdit}
              aria-label={`Edit ${block.type} block`}
            >
              <BlockPreview block={block} />
            </button>
          )}
        </div>
        {!editing ? (
          <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={onEdit}
              aria-label={`Open ${block.type} block editor`}
            >
              <Pencil className="size-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="cursor-pointer text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label={`Remove ${block.type} block`}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BlockPreview({ block }: { block: StoryBlock }) {
  if (block.type === "timestamp") {
    return (
      <div className="grid min-h-7 min-w-0 items-center gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <span className="min-w-0 truncate text-sm font-semibold uppercase leading-none">
          {block.title}
        </span>
        <span className="text-xs leading-none text-muted-foreground">
          {block.start} - {block.end}
        </span>
      </div>
    );
  }
  if (block.type === "prompt") {
    return (
      <p className="whitespace-pre-wrap text-base italic leading-relaxed text-muted-foreground">
        {block.text}
      </p>
    );
  }
  if (block.type === "transition") {
    const delay = Number.parseFloat(block.delay);
    const label = Number.isFinite(delay) && delay > 0
      ? `${block.transitionType} ${delay}s`
      : block.transitionType;
    return (
      <div className="flex min-h-7 items-center gap-3 text-muted-foreground">
        <span className="h-px min-w-8 flex-1 bg-border" aria-hidden />
        <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium uppercase leading-none">
          {label}
        </span>
        <span className="h-px min-w-8 flex-1 bg-border" aria-hidden />
      </div>
    );
  }
  return <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">{block.text}</p>;
}

function BlockEditor({
  block,
  onPatch,
}: {
  block: StoryBlock;
  onPatch: (patch: Partial<StoryBlock>) => void;
}) {
  if (block.type === "timestamp") {
    return (
      <div className="grid gap-2 sm:grid-cols-[1fr_5.5rem_5.5rem]">
        <Input value={block.title} onChange={(e) => onPatch({ title: e.target.value })} aria-label="Timestamp title" />
        <Input value={block.start} onChange={(e) => onPatch({ start: e.target.value })} aria-label="Start time" />
        <Input value={block.end} onChange={(e) => onPatch({ end: e.target.value })} aria-label="End time" />
      </div>
    );
  }

  if (block.type === "transition") {
    return (
      <div className="grid gap-2 sm:grid-cols-[8rem_6rem]">
        <select
          value={block.transitionType}
          onChange={(e) => onPatch({ transitionType: e.target.value as TransitionType })}
          className="h-8 rounded-lg border border-input bg-background px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Transition type"
        >
          {TRANSITION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <Input
          value={block.delay}
          onChange={(e) => onPatch({ delay: e.target.value })}
          aria-label="Transition delay seconds"
        />
      </div>
    );
  }

  return (
    <Textarea
      value={block.text}
      onChange={(e) => onPatch({ text: e.target.value })}
      className="min-h-20 w-full resize-y"
      aria-label={`${block.type} text`}
    />
  );
}
