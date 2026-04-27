import { ArrowUp, Check, Loader2, Pencil, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TRANSITION_TYPES,
  markdownToStoryBlocks,
  storyBlocksToMarkdown,
  type StoryBlock,
  type TransitionType,
} from "@/lib/storyMarkdown";
import { cn } from "@/lib/utils";
import { useStoryNextContext } from "@/context/StoryNextProvider";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";

type AiActionState = "idle" | "rolling" | "editing" | "done";

function summarizeBlock(block: StoryBlock): string {
  if (block.type === "timestamp") return `${block.title} (${block.start}-${block.end})`;
  if (block.type === "transition") return `${block.transitionType}, ${block.delay || "0"}s`;
  return block.text;
}

function blockTextForAi(block: StoryBlock): string {
  if (block.type === "dialogue" || block.type === "prompt") return block.text;
  return "";
}

function reviseTextForAi(text: string, command: string): string {
  const clean = text.trim();
  const lower = command.toLowerCase();
  if (!clean) return clean;
  if (lower.includes("short") || lower.includes("tight")) {
    const words = clean.split(/\s+/);
    return words.length > 24 ? `${words.slice(0, 24).join(" ")}.` : clean;
  }
  if (lower.includes("clear") || lower.includes("simple")) {
    return clean
      .replace(/\s*[—-]\s*/g, " - ")
      .replace(/\bvery\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  if (lower.includes("cta") || lower.includes("subscribe")) {
    return clean.toLowerCase().includes("subscribe")
      ? clean
      : `${clean} Subscribe for more practical, no-fluff guidance.`;
  }
  if (lower.includes("energy") || lower.includes("punch")) {
    return clean.endsWith("!") ? clean : `${clean.replace(/[.!?]*$/, "")}!`;
  }
  return clean.endsWith(".") || clean.endsWith("!") || clean.endsWith("?")
    ? clean
    : `${clean}.`;
}

function applyAiEdit(blocks: StoryBlock[], command: string): { blocks: StoryBlock[]; changedIds: string[] } {
  const firstEditableIndex = blocks.findIndex((block) => block.type === "dialogue");
  if (firstEditableIndex < 0) return { blocks, changedIds: [] };

  const changedIds: string[] = [];
  const next = blocks.map((block, index) => {
    if (index !== firstEditableIndex) return block;
    const updated = reviseTextForAi(blockTextForAi(block), command);
    if (!updated || updated === blockTextForAi(block)) return block;
    changedIds.push(block.id);
    return { ...block, text: updated };
  });

  return { blocks: next, changedIds };
}

export function StoryPageView() {
  const project = useStore(useProjectStore, selectCurrentProject);
  const setPromptText = useStore(useProjectStore, (s) => s.setPromptText);
  const { flowError } = useStoryNextContext();

  const blocks = useMemo(() => markdownToStoryBlocks(project.prompt), [project.prompt]);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiActionState, setAiActionState] = useState<AiActionState>("idle");
  const [aiStatus, setAiStatus] = useState("Ask for a script change.");
  const [aiChangedIds, setAiChangedIds] = useState<string[]>([]);
  const [undoPrompt, setUndoPrompt] = useState<string | null>(null);
  const aiTimers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      aiTimers.current.forEach(window.clearTimeout);
    };
  }, []);

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

  const runAiEdit = useCallback(() => {
    const command = aiInput.trim();
    if (!command || aiActionState !== "idle") return;

    aiTimers.current.forEach(window.clearTimeout);
    aiTimers.current = [];
    setUndoPrompt(project.prompt);
    setAiChangedIds([]);
    setAiActionState("rolling");
    setAiStatus("Reading the script...");

    aiTimers.current.push(
      window.setTimeout(() => {
        setAiActionState("editing");
        setAiStatus("Applying block edits...");
      }, 650),
    );
    aiTimers.current.push(
      window.setTimeout(() => {
        const result = applyAiEdit(markdownToStoryBlocks(useProjectStore.getState().project.prompt), command);
        writeBlocks(result.blocks);
        setAiChangedIds(result.changedIds);
        setAiActionState("done");
        setAiStatus(result.changedIds.length > 0 ? "Edited block ready to review." : "No matching edit found.");
        setAiInput("");
      }, 1300),
    );
  }, [aiActionState, aiInput, project.prompt, writeBlocks]);

  const undoAiEdit = useCallback(() => {
    if (!undoPrompt) return;
    setPromptText(undoPrompt);
    setUndoPrompt(null);
    setAiChangedIds([]);
    setAiActionState("idle");
    setAiStatus("Change undone.");
  }, [setPromptText, undoPrompt]);

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
        <div className="flex flex-col gap-2">
          {blocks.length > 0 ? (
            blocks.map((block) => (
              <StoryBlockRow
                key={block.id}
                block={block}
                changed={aiChangedIds.includes(block.id)}
                editing={editingBlockId === block.id}
                onEdit={() => setEditingBlockId(block.id)}
                onDone={() => setEditingBlockId(null)}
                onPatch={(patch) => patchBlock(block.id, patch)}
              />
            ))
          ) : (
            <button
              type="button"
              className="min-h-48 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-left text-muted-foreground transition-colors hover:bg-muted/35"
              onClick={() => {
                setPromptText("Write a simple story...");
                setEditingBlockId("block-0");
              }}
            >
              Write a simple story...
            </button>
          )}
        </div>
      </main>

      <div className="fixed bottom-5 left-1/2 z-30 w-[min(calc(100vw-2rem),38rem)] -translate-x-1/2">
        <section className="overflow-hidden rounded-[1.75rem] bg-muted/95 shadow-2xl backdrop-blur">
          {aiActionState !== "idle" || aiChangedIds.length > 0 ? (
            <div className="px-5 pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {aiActionState === "done" ? (
                  <Check className="size-4 shrink-0 text-foreground" aria-hidden />
                ) : (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate">{aiStatus}</span>
              </div>
              {aiChangedIds.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {blocks
                    .filter((block) => aiChangedIds.includes(block.id))
                    .map((block) => (
                      <div key={block.id} className="line-clamp-2 pl-6 text-sm leading-snug text-foreground/90">
                        {summarizeBlock(block)}
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-1.5 p-2.5">
            <Input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runAiEdit();
              }}
              placeholder="Edit your story"
              disabled={aiActionState === "rolling" || aiActionState === "editing"}
              aria-label="Script change request"
              className="h-9 border-0 bg-transparent px-3 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            {undoPrompt ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 cursor-pointer rounded-full text-muted-foreground hover:text-foreground"
                onClick={undoAiEdit}
                aria-label="Undo last edit"
              >
                <RotateCcw className="size-4" aria-hidden />
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              className="size-9 shrink-0 cursor-pointer rounded-full bg-foreground text-background shadow-none hover:bg-foreground/90 disabled:bg-muted-foreground/30 disabled:text-background/70"
              onClick={runAiEdit}
              disabled={!aiInput.trim() || aiActionState === "rolling" || aiActionState === "editing"}
              aria-label="Send script change request"
            >
              <ArrowUp className="size-5" aria-hidden />
            </Button>
          </div>
        </section>
      </div>
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
}: {
  block: StoryBlock;
  changed: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onPatch: (patch: Partial<StoryBlock>) => void;
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
        "group rounded-md border px-3 py-2 transition-colors",
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            onClick={onEdit}
            aria-label={`Open ${block.type} block editor`}
          >
            <Pencil className="size-3.5" aria-hidden />
          </Button>
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
