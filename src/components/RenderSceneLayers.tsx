import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Trash2,
} from "lucide-react";

import { findRender, frameHasOutputImage } from "@/lib/frameRenderStatus";
import { formatFilmSegmentClock } from "@/lib/filmTime";
import { getFilmTimingByProjectFrameId } from "@/lib/renderFilmTimeline";
import { framesForSceneSorted } from "@/lib/sceneFrames";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";
import type { AssetBundle } from "@/types/styleConfig";
import type { Frame, Render, Scene } from "@/types/project";

function isFrameRenderingUi(
  frame: Frame,
  render: Render | undefined,
  renderingFrameIds: Record<string, true>,
): boolean {
  if (renderingFrameIds[frame.id]) return true;
  if (render?.engine === "openai-image") {
    return false;
  }
  return render?.status === "pending" || render?.status === "processing";
}

function FrameThumbGloss() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden rounded-[inherit]"
      aria-hidden
    >
      <div className="absolute inset-0 bg-white/[0.18] backdrop-blur-[2px]" />
      <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.4)]" />
      <div className="absolute inset-0 overflow-hidden rounded-[inherit] opacity-[0.92]">
        <div className="render-glass-shimmer-sweep absolute left-0 top-0 h-full min-h-full will-change-transform">
          <div className="render-glass-shimmer-band" />
        </div>
      </div>
    </div>
  );
}

type Props = {
  scenes: Scene[];
  frames: Frame[];
  renders: Render[];
  assetBundle: AssetBundle;
  className?: string;
  /** Full-height rail: flat chrome; same folder / frame rows. */
  variant?: "default" | "sidebar";
  /** Seek the film to this project frame (e.g. row click). */
  onFrameSeek?: (frameId: string) => void;
  /** Project frame id matching the current film playhead (sidebar row background). */
  playbackActiveFrameId?: string | null;
};

export function RenderSceneLayers({
  scenes,
  frames,
  renders,
  assetBundle,
  className,
  variant = "default",
  onFrameSeek,
  playbackActiveFrameId = null,
}: Props) {
  const removeFrame = useStore(useProjectStore, (s) => s.removeFrame);
  const renderingFrameIds = useStore(useProjectStore, (s) => s.renderingFrameIds);
  const layersScrollRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(
    () => [...scenes].sort((a, b) => a.index - b.index),
    [scenes],
  );

  const frameFilmTiming = useMemo(
    () => getFilmTimingByProjectFrameId(scenes, frames, renders, assetBundle),
    [scenes, frames, renders, assetBundle],
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
            "py-0 pr-0.5 pl-0",
            isSidebar ? "" : "max-h-[min(70vh,28rem)] overflow-y-auto py-1 pl-1",
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
                            const timing = frameFilmTiming.get(fr.id);
                            const startSs = timing?.startSeconds ?? 0;
                            const rowRender = findRender(renders, fr);
                            const rowGloss = isFrameRenderingUi(fr, rowRender, renderingFrameIds);
                            return (
                              <li
                                key={fr.id}
                                role="treeitem"
                                data-frame-row-id={fr.id}
                                className="group relative"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    onFrameSeek?.(fr.id);
                                  }}
                                  className={cn(
                                    "flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-sm py-0.5 pl-1 text-left text-base leading-tight",
                                    "pr-1 group-hover:pr-9",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                                    isPlaybackActive ? "bg-muted/90" : "",
                                  )}
                                >
                                  <span className="relative h-6 w-10 shrink-0 overflow-hidden rounded-[2px] bg-muted">
                                    {frameHasOutputImage(fr.src) ? (
                                      <img
                                        src={fr.src}
                                        alt=""
                                        className="relative z-0 h-full w-full object-cover"
                                      />
                                    ) : null}
                                    {rowGloss ? <FrameThumbGloss /> : null}
                                  </span>
                                  <span
                                    className="min-w-0 flex-1 truncate text-base"
                                    title="Start time in the film"
                                  >
                                    {formatFilmSegmentClock(startSs)}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Remove frame at ${formatFilmSegmentClock(startSs)}`}
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
          Each frame row shows start time in the film (minutes:seconds.hundredths). Click a frame to
          seek the film to that frame.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Click a frame row to seek the film to that frame.
        </p>
      )}
    </div>
  );
}
