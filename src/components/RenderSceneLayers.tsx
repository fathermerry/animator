import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Folder, FolderOpen, X } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { formatFilmTime } from "@/lib/filmTime";
import { framesForSceneSorted } from "@/lib/sceneFrames";
import { cn } from "@/lib/utils";
import type { Frame, Render, Scene } from "@/types/project";

type PopupState = {
  frame: Frame;
  scene: Scene;
  render: Render | undefined;
  anchorRect: DOMRect;
};

function findRender(renders: Render[], frame: Frame): Render | undefined {
  return renders.find((r) => r.id === frame.renderId);
}

function FrameDetailPopup({
  state,
  onClose,
}: {
  state: PopupState;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { frame, scene, render } = state;

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const ar = state.anchorRect;

    /** Prefer to the right of the row; fall back to the left if it would overflow. */
    let left = ar.right + pad;
    if (left + w > vw - pad) {
      left = ar.left - w - pad;
    }
    if (left < pad) left = pad;
    if (left + w > vw - pad) left = vw - w - pad;

    let top = ar.top;
    if (top + h > vh - pad) top = vh - h - pad;
    if (top < pad) top = pad;

    setPos({ top, left });
  }, [state.anchorRect, state.frame.id, scene.id, render?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 cursor-default bg-black/20"
        aria-label="Dismiss frame details"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="frame-detail-title"
        className={cn(
          "fixed z-[51] w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-border bg-popover p-4 pt-3 text-popover-foreground shadow-lg",
          pos ? "opacity-100" : "opacity-0",
        )}
        style={
          pos
            ? { top: pos.top, left: pos.left }
            : {
                top: Math.max(8, state.anchorRect.top),
                left: Math.min(
                  state.anchorRect.right + 8,
                  typeof window !== "undefined" ? window.innerWidth - 320 - 8 : 8,
                ),
              }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </button>
        <div className="flex flex-col gap-3 pr-6">
          <div className="overflow-hidden rounded-md bg-muted/40">
            <img
              src={frame.src}
              alt=""
              className="aspect-video w-full object-cover"
            />
          </div>
          <div>
            <p id="frame-detail-title" className="text-base leading-snug text-foreground">
              Scene {scene.index + 1}
            </p>
            {scene.action.trim() ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{scene.action}</p>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">
              Frame {frame.index + 1} · {formatFilmTime(scene.durationSeconds)}s
            </p>
          </div>
          <Separator />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-base">
            <dt className="text-muted-foreground">Frame id</dt>
            <dd className="min-w-0 font-mono text-base leading-snug text-foreground">{frame.id}</dd>
            <dt className="text-muted-foreground">Scene id</dt>
            <dd className="min-w-0 font-mono text-base leading-snug text-foreground">{frame.sceneId}</dd>
            <dt className="text-muted-foreground">Render</dt>
            <dd className="min-w-0 font-mono text-base leading-snug text-foreground">
              {render ? `${render.engine} · ${render.status}` : "—"}
            </dd>
            {render ? (
              <>
                <dt className="text-muted-foreground">Render id</dt>
                <dd className="min-w-0 font-mono text-base leading-snug text-foreground">{render.id}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Source</dt>
            <dd className="min-w-0 break-all font-mono text-base leading-snug text-foreground">{frame.src}</dd>
          </dl>
        </div>
      </div>
    </>,
    document.body,
  );
}

type Props = {
  scenes: Scene[];
  frames: Frame[];
  renders: Render[];
  className?: string;
  /** Full-height rail: flat chrome; same folder / frame rows. */
  variant?: "default" | "sidebar";
};

export function RenderSceneLayers({
  scenes,
  frames,
  renders,
  className,
  variant = "default",
}: Props) {
  const ordered = useMemo(
    () => [...scenes].sort((a, b) => a.index - b.index),
    [scenes],
  );
  const sceneIdKey = useMemo(() => ordered.map((s) => s.id).join("\0"), [ordered]);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedById((prev) => {
      const next = { ...prev };
      for (const s of ordered) {
        if (next[s.id] === undefined) next[s.id] = true;
      }
      return next;
    });
  }, [sceneIdKey, ordered]);

  const [popup, setPopup] = useState<PopupState | null>(null);
  const closePopup = useCallback(() => setPopup(null), []);

  const toggleScene = (sceneId: string) => {
    setExpandedById((p) => ({ ...p, [sceneId]: !p[sceneId] }));
  };

  const isSidebar = variant === "sidebar";

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col",
        isSidebar ? "min-h-0 flex-1 gap-2" : "gap-3",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col overflow-hidden",
          isSidebar
            ? "min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none ring-0"
            : "rounded-lg border border-border/80 bg-muted/25 shadow-sm ring-1 ring-foreground/[0.06]",
        )}
        role="tree"
        aria-label="Scene and frame layers"
      >
        <div
          className={cn(
            "overflow-y-auto py-0 pr-0.5 pl-0",
            isSidebar ? "min-h-0 flex-1" : "max-h-[min(70vh,28rem)] py-1 pl-1",
          )}
        >
          {ordered.length === 0 ? (
            <p className="archive-text px-2 py-3 text-sm text-muted-foreground">No scenes.</p>
          ) : (
            <ul className="flex list-none flex-col gap-0 p-0" role="presentation">
              {ordered.map((scene) => {
                const sceneFrames = framesForSceneSorted(frames, scene.id);
                const expanded = expandedById[scene.id] !== false;
                return (
                  <li key={scene.id} role="treeitem" aria-expanded={expanded} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => toggleScene(scene.id)}
                      className={cn(
                        "flex h-7 w-full min-w-0 items-center gap-0.5 rounded-sm px-1 text-left text-base leading-none",
                        "text-foreground hover:bg-foreground/[0.06]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                      )}
                    >
                      <span className="flex h-7 w-5 shrink-0 items-center justify-center text-muted-foreground">
                        {expanded ? (
                          <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden />
                        ) : (
                          <ChevronRight className="size-3.5" strokeWidth={2} aria-hidden />
                        )}
                      </span>
                      <span className="flex h-7 w-4 shrink-0 items-center justify-center text-muted-foreground">
                        {expanded ? (
                          <FolderOpen className="size-4" strokeWidth={1.75} aria-hidden />
                        ) : (
                          <Folder className="size-4" strokeWidth={1.75} aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 tabular-nums">
                        Scene {scene.index + 1}
                      </span>
                    </button>

                    {expanded ? (
                      <ul
                        className="relative ml-3 mt-0.5 flex list-none flex-col gap-0 pb-1 pl-2 pt-0"
                        role="group"
                      >
                        {sceneFrames.length === 0 ? (
                          <li className="px-1 py-1 pl-2 text-sm text-muted-foreground">Empty</li>
                        ) : (
                          sceneFrames.map((fr) => {
                            const isOpen = popup?.frame.id === fr.id;
                            return (
                              <li key={fr.id} role="treeitem" className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                    setPopup((prev) => {
                                      if (prev?.frame.id === fr.id) return null;
                                      return {
                                        frame: fr,
                                        scene,
                                        render: findRender(renders, fr),
                                        anchorRect: rect,
                                      };
                                    });
                                  }}
                                  className={cn(
                                    "flex h-8 w-full min-w-0 items-center gap-2 rounded-sm py-0.5 pr-1 pl-1 text-left text-base leading-tight",
                                    "hover:bg-foreground/[0.06]",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                                    isOpen ? "bg-muted/90" : "",
                                  )}
                                >
                                  <span className="relative h-6 w-10 shrink-0 overflow-hidden rounded-[2px] bg-muted">
                                    <img
                                      src={fr.src}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">Frame {fr.index + 1}</span>
                                </button>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {isSidebar ? (
        <p className="sr-only">Select a frame to inspect details.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Select a frame to inspect details.</p>
      )}

      {popup ? (
        <FrameDetailPopup state={popup} onClose={closePopup} />
      ) : null}
    </div>
  );
}
