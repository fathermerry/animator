import type { PlayerRef } from "@remotion/player";
import { ChevronLeft, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import {
  FilmShotsEmptySkeletonList,
  FrameListEmptySkeletonRows,
} from "@/components/FrameListEmptySkeletonRows";
import { RenderFilmPreview } from "@/components/RenderFilmPreview";
import { WorkflowStepPage } from "@/components/WorkflowStepPage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDurationMmSs } from "@/lib/filmTime";
import { frameHasOutputImage } from "@/lib/frameRenderStatus";
import { validateBackgroundImageFile } from "@/lib/kitAssetPng";
import { kitAssetDisplaySrc } from "@/lib/kitAssetDisplaySrc";
import { captionCueForVoiceoverSync } from "@/lib/filmPreviewCaptions";
import {
  buildRenderFilmTimeline,
  FILM_FPS,
  getFilmPlaybackWithinScene,
  getFilmStartFrameIndexForFrame,
  getFilmStartFrameIndexForScene,
  getPlaybackContextAtFilmGlobalFrame,
} from "@/lib/renderFilmTimeline";
import { framesForSceneSorted } from "@/lib/sceneFrames";
import { useNarrationFilmSync } from "@/lib/useNarrationFilmSync";
import { useStoryNextContext } from "@/context/StoryNextProvider";
import { cn } from "@/lib/utils";
import { selectResolvedStyleBundle, useProjectStore } from "@/store/projectStore";

export function ComposePageView() {
  const { flowError } = useStoryNextContext();
  const assetBundle = useStore(useProjectStore, selectResolvedStyleBundle);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const frames = useStore(useProjectStore, (s) => s.frames);
  const renders = useStore(useProjectStore, (s) => s.renders);
  const renderingFrameIds = useStore(useProjectStore, (s) => s.renderingFrameIds);
  const frameRenderErrors = useStore(useProjectStore, (s) => s.frameRenderErrors);
  const requestFrameRender = useStore(useProjectStore, (s) => s.requestFrameRender);
  const narrationGeneratingKeys = useStore(useProjectStore, (s) => s.narrationGeneratingKeys);
  const narrationRenderErrors = useStore(useProjectStore, (s) => s.narrationRenderErrors);
  const patchFrame = useStore(useProjectStore, (s) => s.patchFrame);
  const patchRender = useStore(useProjectStore, (s) => s.patchRender);

  const orderedScenes = useMemo(() => [...scenes].sort((a, b) => a.index - b.index), [scenes]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [filmGlobalFrame, setFilmGlobalFrame] = useState(0);
  const [filmPlaying, setFilmPlaying] = useState(false);
  const [frameReplaceErrors, setFrameReplaceErrors] = useState<Record<string, string>>({});
  /** Full-screen keyframe editor; null when closed. */
  const [editorFrameId, setEditorFrameId] = useState<string | null>(null);
  const filmPlayerRef = useRef<PlayerRef>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const replaceTargetFrameIdRef = useRef<string | null>(null);
  const keyframeFileInputRef = useRef<HTMLInputElement>(null);
  const keyframePreviewWheelRef = useRef<HTMLDivElement>(null);
  /** Defer single-click "jump" so a double-click can open the editor instead. */
  const keyframeJumpClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelectedSceneId((prev) => {
      if (orderedScenes.length === 0) return null;
      if (prev && orderedScenes.some((s) => s.id === prev)) return prev;
      return orderedScenes[0]!.id;
    });
  }, [orderedScenes]);

  const editingFrame = useMemo(
    () => (editorFrameId ? frames.find((f) => f.id === editorFrameId) ?? null : null),
    [editorFrameId, frames],
  );
  const editingFrameIndex = useMemo(() => {
    if (!editingFrame || !selectedSceneId) return -1;
    return framesForSceneSorted(frames, selectedSceneId).findIndex((f) => f.id === editingFrame.id);
  }, [editingFrame, frames, selectedSceneId]);

  const keyframePositionLabel = useMemo(() => {
    if (editingFrameIndex < 0 || !selectedSceneId) return "";
    const sceneOrdinal = orderedScenes.findIndex((s) => s.id === selectedSceneId);
    if (sceneOrdinal < 0) return String(editingFrameIndex + 1);
    return `${sceneOrdinal + 1}.${editingFrameIndex + 1}`;
  }, [editingFrameIndex, selectedSceneId, orderedScenes]);

  const goAdjacentKeyframe = useCallback(
    (delta: -1 | 1) => {
      if (!selectedSceneId || editorFrameId == null) return;
      const list = framesForSceneSorted(frames, selectedSceneId);
      const idx = list.findIndex((f) => f.id === editorFrameId);
      if (idx < 0) return;
      const next = list[idx + delta];
      if (next) setEditorFrameId(next.id);
    },
    [selectedSceneId, editorFrameId, frames],
  );

  const setFrameProductionType = useCallback(
    (frameId: string, productionType: "llm" | "remotion-shapes") => {
      const frame = frames.find((f) => f.id === frameId);
      if (!frame) return;
      if (productionType === "remotion-shapes") {
        patchFrame(frameId, { productionType, src: "" });
        patchRender(frame.renderId, {
          engine: "remotion",
          status: "complete",
          startedAt: undefined,
          endedAt: undefined,
        });
        return;
      }

      patchFrame(frameId, { productionType });
      patchRender(frame.renderId, {
        engine: "openai-image",
        status: frameHasOutputImage(frame.src) ? "complete" : "pending",
        startedAt: undefined,
        endedAt: undefined,
      });
    },
    [frames, patchFrame, patchRender],
  );

  useEffect(() => {
    if (editorFrameId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditorFrameId(null);
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || t.isContentEditable) return;
      }
      e.preventDefault();
      if (e.key === "ArrowLeft") goAdjacentKeyframe(-1);
      else goAdjacentKeyframe(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editorFrameId, goAdjacentKeyframe]);

  useEffect(() => {
    if (editorFrameId == null) return;
    const el = keyframePreviewWheelRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      const dy = e.deltaY;
      if (Math.abs(dx) < 12 && Math.abs(dy) >= Math.abs(dx)) return;
      e.preventDefault();
      if (dx > 12) goAdjacentKeyframe(1);
      else if (dx < -12) goAdjacentKeyframe(-1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [editorFrameId, goAdjacentKeyframe]);

  useEffect(() => {
    if (!editorFrameId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editorFrameId]);

  useEffect(() => {
    return () => {
      if (keyframeJumpClickTimeoutRef.current) {
        clearTimeout(keyframeJumpClickTimeoutRef.current);
        keyframeJumpClickTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!editorFrameId || !selectedSceneId) return;
    const f = frames.find((x) => x.id === editorFrameId);
    if (!f || f.sceneId !== selectedSceneId) setEditorFrameId(null);
  }, [editorFrameId, frames, selectedSceneId]);

  const selectedScene = useMemo(
    () => (selectedSceneId ? orderedScenes.find((s) => s.id === selectedSceneId) ?? null : null),
    [orderedScenes, selectedSceneId],
  );
  const selectedSceneFrames = useMemo(
    () => (selectedSceneId ? framesForSceneSorted(frames, selectedSceneId) : []),
    [frames, selectedSceneId],
  );

  const { totalFrames } = useMemo(
    () => buildRenderFilmTimeline(orderedScenes, frames, renders, assetBundle),
    [orderedScenes, frames, renders, assetBundle],
  );
  const playbackWithin = useMemo(
    () => getFilmPlaybackWithinScene(filmGlobalFrame, orderedScenes, frames, renders, assetBundle),
    [filmGlobalFrame, orderedScenes, frames, renders, assetBundle],
  );

  const { sceneId: playheadSceneId, frameId: playheadFrameId } = useMemo(
    () => getPlaybackContextAtFilmGlobalFrame(filmGlobalFrame, orderedScenes, frames, renders, assetBundle),
    [filmGlobalFrame, orderedScenes, frames, renders, assetBundle],
  );

  const playheadScene = useMemo(
    () => (playheadSceneId ? orderedScenes.find((s) => s.id === playheadSceneId) ?? null : null),
    [orderedScenes, playheadSceneId],
  );

  const narrationSrc = playheadScene?.narrationAudioSrc?.trim() ?? "";

  const outsideCaption = useMemo(() => {
    const vo = playheadScene?.voiceoverText?.trim() ?? "";
    if (!vo) return undefined;
    const ratio =
      playbackWithin && playbackWithin.sceneFilmDurationSeconds > 0
        ? Math.min(
            1,
            Math.max(0, playbackWithin.elapsedInSceneSeconds / playbackWithin.sceneFilmDurationSeconds),
          )
        : 0;
    return captionCueForVoiceoverSync(vo, ratio);
  }, [playheadScene?.voiceoverText, playbackWithin]);

  const sceneHasKeyframeWork = useCallback(
    (sceneId: string) =>
      frames.some((f) => f.sceneId === sceneId && Boolean(renderingFrameIds[f.id])),
    [frames, renderingFrameIds],
  );

  useEffect(() => {
    const audio = narrationAudioRef.current;
    if (!audio) return;
    if (!narrationSrc) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    const resolved = new URL(narrationSrc, window.location.origin).href;
    if (audio.src !== resolved) {
      audio.src = narrationSrc;
      audio.load();
    }
  }, [narrationSrc]);

  useNarrationFilmSync(narrationAudioRef, narrationSrc, playbackWithin, filmGlobalFrame, filmPlaying);

  const handleFilmGlobalFrameChange = useCallback(
    (f: number) => {
      setFilmGlobalFrame(f);
      const ctx = getPlaybackContextAtFilmGlobalFrame(f, orderedScenes, frames, renders, assetBundle);
      if (ctx.sceneId) setSelectedSceneId(ctx.sceneId);
    },
    [orderedScenes, frames, renders, assetBundle],
  );

  const seekFilmToFrame = useCallback(
    (frameId: string) => {
      const idx = getFilmStartFrameIndexForFrame(frameId, orderedScenes, frames, renders, assetBundle);
      if (idx == null) return;
      filmPlayerRef.current?.seekTo(idx);
      handleFilmGlobalFrameChange(idx);
    },
    [orderedScenes, frames, renders, assetBundle, handleFilmGlobalFrameChange],
  );

  const seekFilmToScene = useCallback(
    (sceneId: string) => {
      const idx = getFilmStartFrameIndexForScene(sceneId, orderedScenes, frames, renders, assetBundle);
      if (idx == null) return;
      filmPlayerRef.current?.seekTo(idx);
      setFilmPlaying(false);
      handleFilmGlobalFrameChange(idx);
    },
    [orderedScenes, frames, renders, assetBundle, handleFilmGlobalFrameChange],
  );

  const onKeyframeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const frameId = replaceTargetFrameIdRef.current;
    replaceTargetFrameIdRef.current = null;
    if (!file || !frameId) return;
    const result = await validateBackgroundImageFile(file);
    if (!result.ok) {
      setFrameReplaceErrors((prev) => ({ ...prev, [frameId]: result.reason }));
      return;
    }
    setFrameReplaceErrors((prev) => {
      const next = { ...prev };
      delete next[frameId];
      return next;
    });
    patchFrame(frameId, { src: result.dataUrl });
  };

  const scenesAndKeyframesPanel =
    orderedScenes.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <FilmShotsEmptySkeletonList />
        </div>
      </div>
    ) : (
      <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
        <input
          ref={keyframeFileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-hidden
          onChange={(e) => void onKeyframeFileChange(e)}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ul className="list-none space-y-2 p-0" role="list">
            {orderedScenes.map((sc, i) => {
              const title = sc.title.trim() || "Untitled";
              const selected = selectedSceneId === sc.id;
              const audioError = narrationRenderErrors[sc.id];
              const keyframeBusy = sceneHasKeyframeWork(sc.id);
              const audioGenerating = Boolean(narrationGeneratingKeys[sc.id]);
              const shotGenerating = keyframeBusy || audioGenerating;
              const sceneFrames = framesForSceneSorted(frames, sc.id);
              return (
                <li key={sc.id} className="list-none">
                  <div
                    className={cn(
                      "rounded-lg border border-transparent px-1.5 py-1.5 transition-colors",
                      selected && "border-border/50 bg-muted/50",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => seekFilmToScene(sc.id)}
                      className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 text-left"
                      aria-busy={shotGenerating}
                    >
                      <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">{title}</span>
                      <span className="flex w-10 shrink-0 justify-end tabular-nums">
                        {shotGenerating ? (
                          <Loader2
                            className="size-3.5 animate-spin text-muted-foreground"
                            aria-label="Generating image or audio"
                          />
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {formatDurationMmSs(sc.durationSeconds)}
                          </span>
                        )}
                      </span>
                    </button>
                    {audioError ? (
                      <p className="mt-1 pl-6 text-xs text-destructive" role="alert">
                        {audioError}
                      </p>
                    ) : null}
                    {sceneFrames.length === 0 ? (
                      <ul
                        className="mt-1.5 ml-1.5 list-none space-y-0.5 border-l border-border/50 pl-2"
                        role="list"
                        aria-label={`Keyframes for ${title} — none yet`}
                      >
                        <FrameListEmptySkeletonRows variant="compose" />
                      </ul>
                    ) : (
                      <ul
                        className="mt-1.5 ml-1.5 list-none space-y-0.5 border-l border-border/50 pl-2"
                        role="list"
                        aria-label={`Keyframes for ${title}`}
                      >
                        {sceneFrames.map((frame, fi) => {
                          const busy = Boolean(renderingFrameIds[frame.id]);
                          const err = frameRenderErrors[frame.id];
                          const hasImg = frameHasOutputImage(frame.src);
                          const isRemotionShape = frame.productionType === "remotion-shapes";
                          const thumbSrc = hasImg ? kitAssetDisplaySrc(frame.src.trim()) : "";
                          const label = frame.description.trim() || "Edit";
                          const badge = `${i + 1}.${fi + 1}`;
                          const rowEmphasized =
                            editorFrameId != null
                              ? editorFrameId === frame.id
                              : playheadFrameId === frame.id;
                          return (
                            <li key={frame.id} className="list-none">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (e.detail === 2) {
                                    if (keyframeJumpClickTimeoutRef.current) {
                                      clearTimeout(keyframeJumpClickTimeoutRef.current);
                                      keyframeJumpClickTimeoutRef.current = null;
                                    }
                                    setSelectedSceneId(sc.id);
                                    setEditorFrameId(frame.id);
                                    seekFilmToFrame(frame.id);
                                    return;
                                  }
                                  if (e.detail === 1) {
                                    if (keyframeJumpClickTimeoutRef.current) {
                                      clearTimeout(keyframeJumpClickTimeoutRef.current);
                                    }
                                    keyframeJumpClickTimeoutRef.current = setTimeout(() => {
                                      keyframeJumpClickTimeoutRef.current = null;
                                      setSelectedSceneId(sc.id);
                                      setEditorFrameId(null);
                                      seekFilmToFrame(frame.id);
                                    }, 220);
                                  }
                                }}
                                className={cn(
                                  "flex w-full min-w-0 cursor-pointer items-center gap-1 rounded-md border border-border/40 bg-card/20 px-1 py-0.5 text-left transition-colors",
                                  "hover:bg-muted/70",
                                  rowEmphasized && "border-border/80 bg-muted/60",
                                )}
                                aria-expanded={editorFrameId === frame.id}
                                aria-haspopup="dialog"
                              >
                                <span className="relative h-7 w-11 shrink-0 overflow-hidden rounded bg-muted ring-1 ring-border/30">
                                  {thumbSrc ? (
                                    <img src={thumbSrc} alt="" className="h-full w-full object-cover" />
                                  ) : isRemotionShape ? (
                                    <span className="absolute inset-0 bg-background">
                                      <span className="absolute left-1 top-1 h-3 w-3 rounded-full bg-cyan-500/80" />
                                      <span className="absolute bottom-1 right-1 h-3 w-5 rotate-[-12deg] bg-orange-500/75" />
                                    </span>
                                  ) : null}
                                  {busy ? (
                                    <span className="absolute inset-0 flex items-center justify-center bg-background/60 text-[10px] font-medium text-muted-foreground">
                                      …
                                    </span>
                                  ) : null}
                                </span>
                                <span className="flex h-5 min-w-[2.25rem] shrink-0 items-center justify-center rounded bg-muted/70 px-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                                  {badge}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[11px] leading-snug text-foreground/90">
                                  {label}
                                </span>
                                {err ? (
                                  <span
                                    className="size-1.5 shrink-0 rounded-full bg-destructive"
                                    title={err}
                                    aria-label="Has error"
                                  />
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );

  const buildPanel = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pt-3 md:pt-5">
      <RenderFilmPreview
        assetBundle={assetBundle}
        scenes={orderedScenes}
        frames={frames}
        renders={renders}
        className="w-full min-h-0 shrink-0"
        filmPlayerRef={filmPlayerRef}
        globalFrame={filmGlobalFrame}
        onGlobalFrameChange={handleFilmGlobalFrameChange}
        onPlayingChange={setFilmPlaying}
        playbackDisabled={totalFrames <= 0}
        outsideCaption={outsideCaption}
        belowVideo={
          totalFrames > 0 ? (
            <div className="flex w-full justify-between text-xs font-medium tabular-nums text-muted-foreground">
              <span>{formatDurationMmSs(filmGlobalFrame / FILM_FPS)}</span>
              <span>{formatDurationMmSs(totalFrames / FILM_FPS)}</span>
            </div>
          ) : null
        }
      />
      <audio ref={narrationAudioRef} className="hidden" preload="auto" aria-hidden />
    </div>
  );

  const closeKeyframeEditor = () => setEditorFrameId(null);

  const keyframeEditorModal =
    editingFrame && selectedScene && editingFrameIndex >= 0 ? (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
        role="dialog"
        aria-modal
        aria-labelledby="keyframe-editor-title"
      >
        <button
          type="button"
          className="absolute inset-0 cursor-default bg-background/50 backdrop-blur-xl animate-in fade-in-0 duration-300"
          aria-label="Close keyframe editor"
          onClick={closeKeyframeEditor}
        />
        <div
          className={cn(
            "relative z-10 flex max-h-[min(92dvh,56rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl ring-1 ring-foreground/5",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-3 duration-300",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
            <h2 id="keyframe-editor-title" className="truncate text-base font-semibold tracking-tight">
              {editingFrame.kind === "transition" ? "Transition" : "Keyframe"}{" "}
              {keyframePositionLabel || String(editingFrameIndex + 1)}
              <span className="ml-2 font-normal text-muted-foreground">
                · {selectedScene.title.trim() || "Scene"}
              </span>
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-full"
              onClick={closeKeyframeEditor}
              aria-label="Close"
            >
              <X className="size-5" strokeWidth={2} aria-hidden />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            <div
              ref={keyframePreviewWheelRef}
              className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border/40"
            >
              {editingFrameIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => goAdjacentKeyframe(-1)}
                  className={cn(
                    "absolute left-2 top-1/2 z-[2] flex size-11 -translate-y-1/2 items-center justify-center rounded-full",
                    "border border-white/25 bg-black/60 text-white shadow-md backdrop-blur-sm",
                    "hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  aria-label="Previous keyframe"
                >
                  <ChevronLeft className="size-6" strokeWidth={2} aria-hidden />
                </button>
              ) : null}
              {editingFrameIndex >= 0 && editingFrameIndex < selectedSceneFrames.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goAdjacentKeyframe(1)}
                  className={cn(
                    "absolute right-2 top-1/2 z-[2] flex size-11 -translate-y-1/2 items-center justify-center rounded-full",
                    "border border-white/25 bg-black/60 text-white shadow-md backdrop-blur-sm",
                    "hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  aria-label="Next keyframe"
                >
                  <ChevronRight className="size-6" strokeWidth={2} aria-hidden />
                </button>
              ) : null}
              {editingFrame.productionType === "remotion-shapes" ? (
                <div className="relative flex h-full min-h-[12rem] items-center justify-center overflow-hidden bg-background p-6">
                  <div className="absolute right-[-12%] top-[12%] h-40 w-40 rounded-full bg-cyan-500/25" />
                  <div className="absolute bottom-[16%] left-[-8%] h-20 w-52 -rotate-12 bg-orange-500/25" />
                  <div className="absolute bottom-[18%] right-[22%] h-20 w-20 rotate-12 border-[10px] border-green-500/35" />
                  <p className="relative z-[1] line-clamp-3 max-w-[82%] text-center text-xl font-semibold leading-tight">
                    {editingFrame.description.trim() || selectedScene.description.trim() || "Remotion frame"}
                  </p>
                </div>
              ) : frameHasOutputImage(editingFrame.src) ? (
                <img
                  src={kitAssetDisplaySrc(editingFrame.src.trim())}
                  alt=""
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                  <p>No image yet — regenerate or upload below.</p>
                </div>
              )}
              {renderingFrameIds[editingFrame.id] ? (
                <div className="absolute inset-0 z-[3] flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
                  <span className="rounded-full bg-background/90 px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-border/60">
                    Generating…
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <label
                htmlFor="keyframe-editor-prompt"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Prompt
              </label>
              <Textarea
                id="keyframe-editor-prompt"
                value={editingFrame.description}
                onChange={(e) => patchFrame(editingFrame.id, { description: e.target.value })}
                className="min-h-[7rem] resize-y text-base leading-snug"
                placeholder="Describe this shot…"
              />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <label
                htmlFor="keyframe-editor-production"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Production
              </label>
              <select
                id="keyframe-editor-production"
                value={editingFrame.productionType ?? "llm"}
                onChange={(e) =>
                  setFrameProductionType(
                    editingFrame.id,
                    e.target.value === "remotion-shapes" ? "remotion-shapes" : "llm",
                  )
                }
                disabled={Boolean(renderingFrameIds[editingFrame.id])}
                className={cn(
                  "h-10 rounded-lg border border-input bg-background px-3 text-base shadow-xs outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
                )}
              >
                <option value="llm">LLM image generation</option>
                <option value="remotion-shapes">Remotion shapes + type</option>
              </select>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/50 pt-5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                disabled={Boolean(renderingFrameIds[editingFrame.id]) || editingFrame.productionType === "remotion-shapes"}
                onClick={() => void requestFrameRender(editingFrame.id)}
              >
                <Sparkles className="size-4" aria-hidden />
                {renderingFrameIds[editingFrame.id] ? "Generating…" : "Regenerate"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(renderingFrameIds[editingFrame.id]) || editingFrame.productionType === "remotion-shapes"}
                onClick={() => {
                  replaceTargetFrameIdRef.current = editingFrame.id;
                  keyframeFileInputRef.current?.click();
                }}
              >
                Replace image
              </Button>
              {frameHasOutputImage(editingFrame.src) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  disabled={Boolean(renderingFrameIds[editingFrame.id])}
                  onClick={() => patchFrame(editingFrame.id, { src: "" })}
                >
                  Clear image
                </Button>
              ) : null}
            </div>

            {frameRenderErrors[editingFrame.id] ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {frameRenderErrors[editingFrame.id]}
              </p>
            ) : null}
            {frameReplaceErrors[editingFrame.id] ? (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {frameReplaceErrors[editingFrame.id]}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        {flowError ? (
          <div className="z-10 shrink-0 border-b border-border/50 bg-background/90 px-3 py-2 backdrop-blur md:px-3">
            <p className="min-w-0 text-sm text-destructive" role="alert">
              {flowError}
            </p>
          </div>
        ) : null}
        <WorkflowStepPage
          className="min-h-0 flex-1"
          primaryClassName="gap-3 bg-background px-3 py-2 md:px-3 lg:basis-auto lg:max-w-[14rem] lg:flex-none lg:shrink-0 lg:border-r lg:border-border/60 lg:px-2.5 lg:py-2"
          panels={[scenesAndKeyframesPanel, buildPanel]}
        />
      </div>
      {keyframeEditorModal}
    </>
  );
}
