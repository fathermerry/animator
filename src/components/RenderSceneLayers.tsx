import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand/react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Trash2,
  X,
} from "lucide-react";

import { formatFilmTime } from "@/lib/filmTime";
import { framesForSceneSorted } from "@/lib/sceneFrames";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";
import type { Frame, Render, Scene } from "@/types/project";

type PopupMode = "hover" | "pinned";

type PopupContentState = {
  frame: Frame;
  scene: Scene;
  render: Render | undefined;
  anchorRect: DOMRect;
};

type PopupState = {
  mode: PopupMode;
  state: PopupContentState;
};

function findRender(renders: Render[], frame: Frame): Render | undefined {
  return renders.find((r) => r.id === frame.renderId);
}

function isPlaceholderFrameSrc(src: string): boolean {
  return src.includes("placeholder.png");
}

function FrameDetailPopup({
  state,
  mode,
  onClose,
  onPointerEnterPanel,
  onPointerLeavePanel,
}: {
  state: PopupContentState;
  mode: PopupMode;
  onClose: () => void;
  onPointerEnterPanel: () => void;
  onPointerLeavePanel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { frame, scene, render } = state;
  const isPinned = mode === "pinned";

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const ar = state.anchorRect;

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
  }, [state.anchorRect, state.frame.id, scene.id, render?.id, render?.status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const subtitle = [
    `Frame ${frame.index + 1}`,
    formatFilmTime(scene.durationSeconds),
    render?.status === "pending" || render?.status === "processing" ? "Rendering…" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const renderInFlight = render?.status === "pending" || render?.status === "processing";
  const showRenderCta =
    !renderInFlight &&
    (isPlaceholderFrameSrc(frame.src) || !render || render.status === "failed");

  return createPortal(
    <>
      {isPinned ? (
        <button
          type="button"
          className="fixed inset-0 z-50 cursor-default bg-black/25"
          aria-label="Dismiss frame preview"
          onClick={onClose}
        />
      ) : null}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={isPinned}
        aria-labelledby="frame-detail-title"
        className={cn(
          "fixed z-[51] w-[min(calc(100vw-2rem),17.5rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl",
          pos ? "opacity-100" : "opacity-0",
          isPinned ? "ring-1 ring-foreground/10" : "ring-0",
        )}
        style={
          pos
            ? { top: pos.top, left: pos.left }
            : {
                top: Math.max(8, state.anchorRect.top),
                left: Math.min(
                  state.anchorRect.right + 8,
                  typeof window !== "undefined" ? window.innerWidth - 280 - 8 : 8,
                ),
              }
        }
        onPointerEnter={onPointerEnterPanel}
        onPointerLeave={onPointerLeavePanel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-video w-full bg-muted/50">
          <img src={frame.src} alt="" className="h-full w-full object-cover" />
          {showRenderCta ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
              <button
                type="button"
                className={cn(
                  "pointer-events-auto cursor-pointer rounded-md border border-border/80 bg-background/90 px-2.5 py-1",
                  "text-sm text-foreground shadow-sm",
                  "hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Render
              </button>
            </div>
          ) : null}
          {isPinned ? (
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full",
                "border border-border/60 bg-background/85 text-foreground shadow-md backdrop-blur-sm",
                "hover:bg-background hover:shadow-lg",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="border-t border-border/80 px-3 pb-2 pt-2.5">
          <p id="frame-detail-title" className="text-base font-medium leading-snug text-foreground">
            {scene.title.trim() || `Scene ${scene.index + 1}`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
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

const HOVER_DISMISS_MS = 220;

export function RenderSceneLayers({
  scenes,
  frames,
  renders,
  className,
  variant = "default",
}: Props) {
  const removeFrame = useStore(useProjectStore, (s) => s.removeFrame);

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
  const hoverDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverDismissTimer = useCallback(() => {
    if (hoverDismissTimerRef.current) {
      clearTimeout(hoverDismissTimerRef.current);
      hoverDismissTimerRef.current = null;
    }
  }, []);

  const closePopup = useCallback(() => {
    clearHoverDismissTimer();
    setPopup(null);
  }, [clearHoverDismissTimer]);

  const scheduleHoverDismiss = useCallback(() => {
    clearHoverDismissTimer();
    hoverDismissTimerRef.current = setTimeout(() => {
      setPopup((p) => (p?.mode === "hover" ? null : p));
      hoverDismissTimerRef.current = null;
    }, HOVER_DISMISS_MS);
  }, [clearHoverDismissTimer]);

  useEffect(() => {
    setPopup((p) => {
      if (!p) return p;
      const nextFrame = frames.find((f) => f.id === p.state.frame.id);
      if (!nextFrame) return null;
      return {
        ...p,
        state: {
          ...p.state,
          frame: nextFrame,
          render: findRender(renders, nextFrame),
        },
      };
    });
  }, [frames, renders]);

  const openHover = useCallback(
    (fr: Frame, scene: Scene, anchorRect: DOMRect) => {
      clearHoverDismissTimer();
      setPopup((prev) => {
        if (prev?.mode === "pinned") return prev;
        return {
          mode: "hover",
          state: {
            frame: fr,
            scene,
            render: findRender(renders, fr),
            anchorRect,
          },
        };
      });
    },
    [clearHoverDismissTimer, renders],
  );

  const pinOrToggle = useCallback(
    (fr: Frame, scene: Scene, anchorRect: DOMRect) => {
      clearHoverDismissTimer();
      setPopup((prev) => {
        if (prev?.state.frame.id === fr.id && prev.mode === "pinned") return null;
        return {
          mode: "pinned",
          state: {
            frame: fr,
            scene,
            render: findRender(renders, fr),
            anchorRect,
          },
        };
      });
    },
    [clearHoverDismissTimer, renders],
  );

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
                      <span className="min-w-0 flex-1 truncate text-left">
                        {scene.title.trim() || `Scene ${scene.index + 1}`}
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
                            const isActive = popup?.state.frame.id === fr.id;
                            return (
                              <li
                                key={fr.id}
                                role="treeitem"
                                className="group relative"
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  openHover(fr, scene, rect);
                                }}
                                onMouseLeave={scheduleHoverDismiss}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const li = (e.currentTarget as HTMLButtonElement).closest("li");
                                    const rect = li?.getBoundingClientRect();
                                    if (!rect) return;
                                    pinOrToggle(fr, scene, rect);
                                  }}
                                  className={cn(
                                    "flex h-8 w-full min-w-0 items-center gap-2 rounded-sm py-0.5 pl-1 text-left text-base leading-tight",
                                    "pr-1 group-hover:pr-9",
                                    "hover:bg-foreground/[0.06]",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                                    isActive ? "bg-muted/90" : "",
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
                                <button
                                  type="button"
                                  aria-label={`Remove frame ${fr.index + 1}`}
                                  className={cn(
                                    "absolute right-0.5 top-1/2 z-[1] flex size-7 -translate-y-1/2 items-center justify-center rounded-sm",
                                    "text-muted-foreground opacity-0 pointer-events-none transition-opacity",
                                    "group-hover:pointer-events-auto group-hover:opacity-100",
                                    "hover:bg-destructive/15 hover:text-destructive",
                                    "focus-visible:pointer-events-auto focus-visible:opacity-100",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  )}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeFrame(fr.id);
                                    setPopup((p) => (p?.state.frame.id === fr.id ? null : p));
                                  }}
                                >
                                  <Trash2 className="size-4" strokeWidth={2} aria-hidden />
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
        <p className="sr-only">Hover a frame for a quick preview; click to pin.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Hover a frame for a quick preview; click to pin.</p>
      )}

      {popup ? (
        <FrameDetailPopup
          state={popup.state}
          mode={popup.mode}
          onClose={closePopup}
          onPointerEnterPanel={clearHoverDismissTimer}
          onPointerLeavePanel={() => {
            if (popup.mode === "hover") scheduleHoverDismiss();
          }}
        />
      ) : null}
    </div>
  );
}
