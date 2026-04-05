import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand/react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Trash2,
} from "lucide-react";

import { findRender } from "@/lib/frameRenderStatus";
import { formatFilmTime } from "@/lib/filmTime";
import { framesForSceneSorted } from "@/lib/sceneFrames";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";
import type { Frame, Render, Scene } from "@/types/project";

type PopupContentState = {
  frame: Frame;
  scene: Scene;
  render: Render | undefined;
  anchorRect: DOMRect;
};

function FrameDetailPopup({
  state,
  onClose,
  onPointerEnterPanel,
  onPointerLeavePanel,
}: {
  state: PopupContentState;
  onClose: () => void;
  onPointerEnterPanel: () => void;
  onPointerLeavePanel: () => void;
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

  const frameDesc = frame.description.trim();

  return createPortal(
    <>
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby="frame-detail-title"
        className={cn(
          "fixed z-[51] w-[min(calc(100vw-2rem),17.5rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl ring-0",
          pos ? "opacity-100" : "opacity-0",
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
        </div>

        <div className="border-t border-border/80 px-3 pb-2 pt-2.5">
          <p id="frame-detail-title" className="text-base font-medium leading-snug text-foreground">
            {scene.title.trim() || "—"}
          </p>
          {frameDesc ? (
            <p className="mt-1 text-sm leading-snug text-foreground">{frameDesc}</p>
          ) : null}
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
  /** Seek the film to this project frame (e.g. row click). */
  onFrameSeek?: (frameId: string) => void;
  /** Project frame id matching the current film playhead (sidebar row background). */
  playbackActiveFrameId?: string | null;
};

const HOVER_DISMISS_MS = 220;

export function RenderSceneLayers({
  scenes,
  frames,
  renders,
  className,
  variant = "default",
  onFrameSeek,
  playbackActiveFrameId = null,
}: Props) {
  const removeFrame = useStore(useProjectStore, (s) => s.removeFrame);
  const layersScrollRef = useRef<HTMLDivElement>(null);

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

  const [popup, setPopup] = useState<PopupContentState | null>(null);
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
      setPopup(null);
      hoverDismissTimerRef.current = null;
    }, HOVER_DISMISS_MS);
  }, [clearHoverDismissTimer]);

  useEffect(() => {
    setPopup((p) => {
      if (!p) return p;
      const nextFrame = frames.find((f) => f.id === p.frame.id);
      if (!nextFrame) return null;
      return {
        ...p,
        frame: nextFrame,
        render: findRender(renders, nextFrame),
      };
    });
  }, [frames, renders]);

  const openHover = useCallback(
    (fr: Frame, scene: Scene, anchorRect: DOMRect) => {
      clearHoverDismissTimer();
      setPopup({
        frame: fr,
        scene,
        render: findRender(renders, fr),
        anchorRect,
      });
    },
    [clearHoverDismissTimer, renders],
  );

  const toggleScene = (sceneId: string) => {
    setExpandedById((p) => ({ ...p, [sceneId]: !p[sceneId] }));
  };

  const isSidebar = variant === "sidebar";

  useEffect(() => {
    if (!playbackActiveFrameId) return;
    const fr = frames.find((f) => f.id === playbackActiveFrameId);
    if (!fr) return;
    setExpandedById((prev) => ({ ...prev, [fr.sceneId]: true }));
  }, [playbackActiveFrameId, frames]);

  useEffect(() => {
    if (!playbackActiveFrameId || !isSidebar) return;
    const id = window.setTimeout(() => {
      layersScrollRef.current
        ?.querySelector<HTMLElement>(`[data-frame-row-id="${playbackActiveFrameId}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 32);
    return () => window.clearTimeout(id);
  }, [playbackActiveFrameId, isSidebar]);

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
          ref={layersScrollRef}
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
                            const isPlaybackActive = playbackActiveFrameId === fr.id;
                            return (
                              <li
                                key={fr.id}
                                role="treeitem"
                                data-frame-row-id={fr.id}
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
                                    if (rect) openHover(fr, scene, rect);
                                    onFrameSeek?.(fr.id);
                                  }}
                                  className={cn(
                                    "flex h-8 w-full min-w-0 items-center gap-2 rounded-sm py-0.5 pl-1 text-left text-base leading-tight",
                                    "pr-1 group-hover:pr-9",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                                    isPlaybackActive ? "bg-muted/90" : "",
                                  )}
                                >
                                  <span className="relative h-6 w-10 shrink-0 overflow-hidden rounded-[2px] bg-muted">
                                    <img
                                      src={fr.src}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">
                                    {`Frame ${fr.index + 1}`}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Remove frame ${fr.index + 1}`}
                                  className={cn(
                                    "absolute right-0.5 top-1/2 z-[1] flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm",
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
                                    setPopup((p) => (p?.frame.id === fr.id ? null : p));
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
        <p className="sr-only">
          Hover a frame to show a preview popover (stays while you hover the row or the popover). Click
          seeks the film to that frame.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Hover a frame to show a preview popover (stays while you hover the row or the popover). Click
          seeks the film to that frame.
        </p>
      )}

      {popup ? (
        <FrameDetailPopup
          state={popup}
          onClose={closePopup}
          onPointerEnterPanel={clearHoverDismissTimer}
          onPointerLeavePanel={scheduleHoverDismiss}
        />
      ) : null}
    </div>
  );
}
