import {
  Bot,
  Check,
  ChevronRight,
  Clock3,
  Loader2,
  Minus,
  Pencil,
  RotateCcw,
  Send,
  Sparkles,
  TextQuote,
  WandSparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { frameHasOutputImage } from "@/lib/frameRenderStatus";
import {
  TRANSITION_TYPES,
  markdownToStoryBlocks,
  storyBlocksToMarkdown,
  type StoryBlock,
  type TransitionType,
} from "@/lib/storyMarkdown";
import { cn } from "@/lib/utils";
import { pathForProjectStep, navigate } from "@/router";
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
  const requestStoryCompose = useStore(useProjectStore, (s) => s.requestStoryCompose);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const renderingAllFrameImages = useStore(useProjectStore, (s) => s.renderingAllFrameImages);

  const blocks = useMemo(() => markdownToStoryBlocks(project.prompt), [project.prompt]);
  const orderedScenes = useMemo(() => [...scenes].sort((a, b) => a.index - b.index), [scenes]);
  const [preparingScenes, setPreparingScenes] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
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

  const prepareScenes = useCallback(async (): Promise<boolean> => {
    if (preparingScenes || !project.prompt.trim()) return true;
    setFlowError(null);
    setPreparingScenes(true);
    try {
      await requestStoryCompose();
      return true;
    } catch (e: unknown) {
      setFlowError(e instanceof Error ? e.message : "Scene prep failed");
      return false;
    } finally {
      setPreparingScenes(false);
    }
  }, [preparingScenes, project.prompt, requestStoryCompose]);

  const storyNextBusy = preparingScenes || renderingAllFrameImages;

  const onStoryNext = useCallback(async () => {
    setFlowError(null);
    if (project.prompt.trim() && orderedScenes.length === 0) {
      const composeOk = await prepareScenes();
      if (!composeOk) return;
    } else {
      const snap = useProjectStore.getState();
      const missing = snap.frames.some((f) => !frameHasOutputImage(f.src));
      if (snap.frames.length > 0 && !snap.renderingAllFrameImages && missing) {
        try {
          await snap.requestFullFilmRender();
        } catch (e: unknown) {
          setFlowError(e instanceof Error ? e.message : "Keyframe generation failed");
          return;
        }
      }
    }
    navigate(pathForProjectStep(project.id, "compose"));
  }, [project.id, project.prompt, orderedScenes.length, prepareScenes]);

  const goStory = useCallback(
    () => navigate(pathForProjectStep(project.id, "story")),
    [project.id],
  );
  const goCompose = useCallback(
    () => navigate(pathForProjectStep(project.id, "compose")),
    [project.id],
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
      <header className="sticky top-0 z-10 shrink-0 py-2.5 md:py-3">
        <div className="flex w-full min-w-0 flex-col gap-2 px-4 md:px-6">
          <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div
              className="inline-flex w-fit max-w-full shrink-0 gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5"
              role="tablist"
              aria-label="Story and compose"
            >
              <Button
                type="button"
                role="tab"
                id="tab-story"
                aria-selected
                variant="secondary"
                className="h-8 min-w-0 cursor-pointer gap-1.5 rounded-md px-3"
                onClick={goStory}
              >
                Story
              </Button>
              <Button
                type="button"
                role="tab"
                id="tab-compose"
                aria-selected={false}
                variant="ghost"
                className="h-8 min-w-0 cursor-pointer gap-1.5 rounded-md px-2.5 sm:px-3"
                onClick={goCompose}
              >
                Compose
              </Button>
            </div>
            <div className="flex min-w-0 flex-1 justify-end">
              <Button
                type="button"
                onClick={() => void onStoryNext()}
                disabled={storyNextBusy}
                className="h-9 cursor-pointer gap-1.5 disabled:cursor-not-allowed"
              >
                {storyNextBusy ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
                Next
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </Button>
            </div>
          </div>
          {flowError ? (
            <p className="min-w-0 text-sm text-destructive" role="alert">
              {flowError}
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-40 pt-8 md:px-8 md:pb-44 md:pt-12">
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

      <div className="fixed bottom-5 right-5 z-30 flex w-[min(calc(100vw-2.5rem),24rem)] flex-col items-end gap-2">
        {chatOpen ? (
          <section className="w-full rounded-lg border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Bot className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">Script assistant</div>
                  <div className="truncate text-xs text-muted-foreground">{aiStatus}</div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 cursor-pointer"
                onClick={() => setChatOpen(false)}
                aria-label="Close script assistant"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="space-y-3 p-3">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm leading-snug text-muted-foreground">
                Ask for a focused change like “tighten the hook”, “make it punchier”, or “add a CTA”.
              </div>

              {aiActionState !== "idle" ? (
                <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  {aiActionState === "done" ? (
                    <Check className="size-4 shrink-0 text-foreground" aria-hidden />
                  ) : (
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">{aiStatus}</span>
                </div>
              ) : null}

              {aiChangedIds.length > 0 ? (
                <div className="rounded-md border border-border p-2">
                  <div className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">
                    Edited blocks
                  </div>
                  <div className="space-y-1">
                    {blocks
                      .filter((block) => aiChangedIds.includes(block.id))
                      .map((block) => (
                        <div key={block.id} className="line-clamp-2 text-sm leading-snug">
                          {summarizeBlock(block)}
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2">
                <Input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runAiEdit();
                  }}
                  placeholder="Tell AI what to change..."
                  disabled={aiActionState === "rolling" || aiActionState === "editing"}
                  aria-label="Script assistant prompt"
                />
                <Button
                  type="button"
                  size="icon"
                  className="size-8 shrink-0 cursor-pointer"
                  onClick={runAiEdit}
                  disabled={!aiInput.trim() || aiActionState === "rolling" || aiActionState === "editing"}
                  aria-label="Send script assistant prompt"
                >
                  <Send className="size-4" aria-hidden />
                </Button>
              </div>

              {undoPrompt ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-full cursor-pointer gap-1.5"
                  onClick={undoAiEdit}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Undo last AI edit
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        <Button
          type="button"
          className="h-11 cursor-pointer gap-2 rounded-full px-4 shadow-lg"
          onClick={() => {
            setChatOpen((open) => !open);
            setAiActionState("idle");
          }}
        >
          <WandSparkles className="size-4" aria-hidden />
          AI edit
        </Button>
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
  const typeIcon =
    block.type === "timestamp" ? (
      <Clock3 className="size-4" aria-hidden />
    ) : block.type === "prompt" ? (
      <Sparkles className="size-4" aria-hidden />
    ) : block.type === "transition" ? (
      <Minus className="size-4" aria-hidden />
    ) : (
      <TextQuote className="size-4" aria-hidden />
    );

  return (
    <div
      className={cn(
        "group rounded-lg border px-3 py-2 transition-colors",
        changed ? "border-foreground bg-muted/50" : "border-transparent hover:border-border hover:bg-muted/25",
      )}
    >
      <div
        className={cn(
          "flex gap-3",
          editing || block.type === "dialogue" ? "items-start" : "items-center",
        )}
      >
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground",
            editing || block.type === "dialogue" ? "mt-0.5" : "mt-0",
          )}
        >
          {typeIcon}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <BlockEditor block={block} onPatch={onPatch} onDone={onDone} />
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
      <p className="flex min-h-7 items-center text-sm italic leading-snug text-muted-foreground">
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
  onDone,
}: {
  block: StoryBlock;
  onPatch: (patch: Partial<StoryBlock>) => void;
  onDone: () => void;
}) {
  if (block.type === "timestamp") {
    return (
      <div className="grid gap-2 sm:grid-cols-[1fr_5.5rem_5.5rem_auto]">
        <Input value={block.title} onChange={(e) => onPatch({ title: e.target.value })} aria-label="Timestamp title" />
        <Input value={block.start} onChange={(e) => onPatch({ start: e.target.value })} aria-label="Start time" />
        <Input value={block.end} onChange={(e) => onPatch({ end: e.target.value })} aria-label="End time" />
        <DoneButton onDone={onDone} />
      </div>
    );
  }

  if (block.type === "transition") {
    return (
      <div className="grid gap-2 sm:grid-cols-[8rem_6rem_auto]">
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
        <DoneButton onDone={onDone} />
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Textarea
        value={block.text}
        onChange={(e) => onPatch({ text: e.target.value })}
        className="min-h-20 resize-y"
        aria-label={`${block.type} text`}
      />
      <DoneButton onDone={onDone} />
    </div>
  );
}

function DoneButton({ onDone }: { onDone: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      className="size-8 shrink-0 cursor-pointer"
      onClick={onDone}
      aria-label="Finish editing block"
    >
      <Check className="size-4" aria-hidden />
    </Button>
  );
}
