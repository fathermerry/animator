import type { PlayerRef } from "@remotion/player";
import { ChevronLeft, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { RenderFilmPreview } from "@/components/RenderFilmPreview";
import { WorkflowStepPage } from "@/components/WorkflowStepPage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDurationMmSs } from "@/lib/filmTime";
import { frameHasOutputImage } from "@/lib/frameRenderStatus";
import { validateBackgroundImageFile } from "@/lib/kitAssetPng";
import { kitAssetDisplaySrc } from "@/lib/kitAssetDisplaySrc";
import { panelHeadingAfterBlockClass, panelHeadingClass } from "@/lib/panelHeading";
import { captionCueForVoiceoverSync } from "@/lib/filmPreviewCaptions";
import {
  buildRenderFilmTimeline,
  FILM_FPS,
  getFilmPlaybackWithinScene,
} from "@/lib/renderFilmTimeline";
import { framesForSceneSorted } from "@/lib/sceneFrames";
import { useNarrationFilmSync } from "@/lib/useNarrationFilmSync";
import { cn } from "@/lib/utils";
import {
  selectCurrentProject,
  selectResolvedStyleBundle,
  useProjectStore,
} from "@/store/projectStore";
import type { Scene } from "@/types/project";

export function StudioPageView() {
  const project = useStore(useProjectStore, selectCurrentProject);
  const assetBundle = useStore(useProjectStore, selectResolvedStyleBundle);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const frames = useStore(useProjectStore, (s) => s.frames);
  const renders = useStore(useProjectStore, (s) => s.renders);
  const renderingFrameIds = useStore(useProjectStore, (s) => s.renderingFrameIds);
  const frameRenderErrors = useStore(useProjectStore, (s) => s.frameRenderErrors);
  const setPromptText = useStore(useProjectStore, (s) => s.setPromptText);
  const requestStoryCompose = useStore(useProjectStore, (s) => s.requestStoryCompose);
  const requestFrameRender = useStore(useProjectStore, (s) => s.requestFrameRender);
  const narrationGeneratingKeys = useStore(useProjectStore, (s) => s.narrationGeneratingKeys);
  const narrationRenderErrors = useStore(useProjectStore, (s) => s.narrationRenderErrors);
  const patchScene = useStore(useProjectStore, (s) => s.patchScene);
  const patchFrame = useStore(useProjectStore, (s) => s.patchFrame);
  const renderingAllFrameImages = useStore(useProjectStore, (s) => s.renderingAllFrameImages);
  const requestFullFilmRender = useStore(useProjectStore, (s) => s.requestFullFilmRender);

  const orderedScenes = useMemo(() => [...scenes].sort((a, b) => a.index - b.index), [scenes]);
  const [studioMode, setStudioMode] = useState<"story" | "film">("story");
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [preparingScenes, setPreparingScenes] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
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

  const previewScenes = useMemo(() => (selectedScene ? [selectedScene] : []), [selectedScene]);
  const previewFrames = selectedSceneFrames;
  const { totalFrames } = useMemo(
    () => buildRenderFilmTimeline(previewScenes, previewFrames, renders, assetBundle),
    [previewScenes, previewFrames, renders, assetBundle],
  );
  const hasAnyMissingFrameImage = useMemo(
    () => frames.some((f) => !frameHasOutputImage(f.src)),
    [frames],
  );
  const playbackWithin = useMemo(
    () => getFilmPlaybackWithinScene(filmGlobalFrame, previewScenes, previewFrames, renders, assetBundle),
    [filmGlobalFrame, previewScenes, previewFrames, renders, assetBundle],
  );
  const narrationSrc = selectedScene?.narrationAudioSrc?.trim() ?? "";
  const canPlayPreview = Boolean(narrationSrc && totalFrames > 0);

  const outsideCaption = useMemo(() => {
    const vo = selectedScene?.voiceoverText?.trim() ?? "";
    if (!vo) return undefined;
    const ratio =
      playbackWithin && playbackWithin.sceneFilmDurationSeconds > 0
        ? Math.min(
            1,
            Math.max(0, playbackWithin.elapsedInSceneSeconds / playbackWithin.sceneFilmDurationSeconds),
          )
        : 0;
    return captionCueForVoiceoverSync(vo, ratio);
  }, [selectedScene?.voiceoverText, playbackWithin]);

  const sceneHasKeyframeWork = useCallback(
    (sceneId: string) =>
      frames.some((f) => f.sceneId === sceneId && Boolean(renderingFrameIds[f.id])),
    [frames, renderingFrameIds],
  );

  useEffect(() => {
    setFilmGlobalFrame(0);
    setFilmPlaying(false);
    narrationAudioRef.current?.pause();
  }, [selectedSceneId]);

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

  const createMissingKeyframeImages = useCallback(async () => {
    if (frames.length === 0 || renderingAllFrameImages || !hasAnyMissingFrameImage) return;
    setFlowError(null);
    try {
      await requestFullFilmRender();
    } catch (e: unknown) {
      setFlowError(e instanceof Error ? e.message : "Keyframe generation failed");
    }
  }, [frames.length, hasAnyMissingFrameImage, renderingAllFrameImages, requestFullFilmRender]);

  const storyNextBusy = preparingScenes || renderingAllFrameImages;

  const onStoryNext = useCallback(async () => {
    setFlowError(null);
    setStudioMode("film");
    let ranStoryCompose = false;
    if (project.prompt.trim()) {
      const composeOk = await prepareScenes();
      if (!composeOk) return;
      ranStoryCompose = true;
    }
    if (ranStoryCompose) return;
    const snap = useProjectStore.getState();
    const missing = snap.frames.some((f) => !frameHasOutputImage(f.src));
    if (snap.frames.length > 0 && !snap.renderingAllFrameImages && missing) {
      try {
        await snap.requestFullFilmRender();
      } catch (e: unknown) {
        setFlowError(e instanceof Error ? e.message : "Keyframe generation failed");
      }
    }
  }, [project.prompt, prepareScenes]);

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

  const scriptPanel = (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-[700px] flex-1 flex-col px-0 py-1">
        <Textarea
          value={project.prompt}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Write a simple story..."
          className={cn(
            "field-sizing-fixed min-h-0 flex-1 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-0 py-2 text-center text-base leading-relaxed shadow-none",
            "text-foreground placeholder:text-muted-foreground/35",
            "focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent",
            "disabled:bg-transparent dark:disabled:bg-transparent",
          )}
          spellCheck
          aria-label="Story"
        />
      </div>
    </div>
  );

  const scenesAndKeyframesPanel =
    orderedScenes.length === 0 ? (
      <div className="flex h-full min-h-0 flex-col justify-center gap-4 px-1">
        <p className={panelHeadingClass}>Film</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You do not have any shots yet. Write your story in the{" "}
          <span className="font-medium text-foreground">Story</span> view, or use{" "}
          <span className="font-medium text-foreground">Create shots</span> in the bar at the top of
          this view, to generate beats, narration, and keyframes.
        </p>
      </div>
    ) : (
      <div className="grid h-full min-h-0 grid-rows-[1fr_auto_1fr] gap-4">
        <section className="flex min-h-0 flex-col gap-2 overflow-hidden">
          <p className={panelHeadingClass}>Shots</p>
          <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
            <ul className="list-none p-0" role="list">
              {orderedScenes.map((sc, i) => {
                const title = sc.title.trim() || `Shot ${i + 1}`;
                const selected = selectedSceneId === sc.id;
                const audioError = narrationRenderErrors[sc.id];
                const keyframeBusy = sceneHasKeyframeWork(sc.id);
                const audioGenerating = Boolean(narrationGeneratingKeys[sc.id]);
                const shotGenerating = keyframeBusy || audioGenerating;
                return (
                  <li key={sc.id} className="list-none">
                    <div className={cn("rounded-md px-2 py-1.5", selected && "bg-muted/80")}>
                      <button
                        type="button"
                        onClick={() => setSelectedSceneId(sc.id)}
                        className="flex w-full min-w-0 cursor-pointer items-center gap-2 text-left"
                        aria-busy={shotGenerating}
                      >
                        <span className="w-6 shrink-0 text-center text-[13px] tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-base">{title}</span>
                        <span className="flex w-[4.5rem] shrink-0 justify-end tabular-nums">
                          {shotGenerating ? (
                            <Loader2
                              className="size-4 animate-spin text-muted-foreground"
                              aria-label="Generating image or audio"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {formatDurationMmSs(sc.durationSeconds)}
                            </span>
                          )}
                        </span>
                      </button>
                      {audioError ? (
                        <p className="pl-8 text-sm text-destructive" role="alert">
                          {audioError}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <div className="-mx-4 border-t border-border/60" aria-hidden />

        <section className="-mx-4 min-h-0 overflow-y-auto px-4">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex min-h-0 flex-col gap-2">
              <p className={panelHeadingAfterBlockClass}>Shot prompt</p>
              {selectedScene ? (
                <Textarea
                  value={selectedScene.description}
                  onChange={(e) => patchScene(selectedScene.id, { description: e.target.value })}
                  className="min-h-[7rem] resize-y text-base leading-snug"
                  aria-label="Shot prompt"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Select a shot.</p>
              )}
            </div>

          <div className="flex min-h-0 flex-col gap-2">
            <p className={panelHeadingAfterBlockClass}>Keyframes</p>
            <input
              ref={keyframeFileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-hidden
              onChange={(e) => void onKeyframeFileChange(e)}
            />
            {selectedSceneFrames.length === 0 ? (
              <p className="text-sm text-muted-foreground">No keyframes in this shot.</p>
            ) : (
              <ul className="flex list-none flex-col gap-1.5 p-0" role="list">
                {selectedSceneFrames.map((frame, i) => {
                  const busy = Boolean(renderingFrameIds[frame.id]);
                  const err = frameRenderErrors[frame.id];
                  const hasImg = frameHasOutputImage(frame.src);
                  const thumbSrc = hasImg ? kitAssetDisplaySrc(frame.src.trim()) : "";
                  const label = frame.description.trim() || "Tap to add prompt and edit";
                  const kindShort = frame.kind === "transition" ? "Tr" : "Kf";
                  return (
                    <li key={frame.id} className="list-none">
                      <button
                        type="button"
                        onClick={() => setEditorFrameId(frame.id)}
                        className={cn(
                          "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card/30 px-2 py-1.5 text-left transition-[background-color,box-shadow,transform] duration-200",
                          "hover:bg-muted/60 hover:shadow-sm active:scale-[0.99]",
                        )}
                        aria-expanded={editorFrameId === frame.id}
                        aria-haspopup="dialog"
                      >
                        <span className="relative h-9 w-14 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/40">
                          {thumbSrc ? (
                            <img src={thumbSrc} alt="" className="h-full w-full object-cover" />
                          ) : null}
                          {busy ? (
                            <span className="absolute inset-0 flex items-center justify-center bg-background/55 text-[11px] font-medium text-muted-foreground">
                              …
                            </span>
                          ) : null}
                        </span>
                        <span className="flex h-6 w-7 shrink-0 items-center justify-center rounded bg-muted/80 text-[11px] font-semibold tabular-nums text-muted-foreground">
                          {kindShort}
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground/90">{label}</span>
                        {err ? (
                          <span
                            className="size-2 shrink-0 rounded-full bg-destructive"
                            title={err}
                            aria-label="Has error"
                          />
                        ) : null}
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground/80"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          </div>
        </section>
      </div>
    );


  const buildPanel = (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className={panelHeadingClass}>Preview</p>
        {totalFrames > 0 ? (
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {formatDurationMmSs(filmGlobalFrame / FILM_FPS)}
            <span className="text-muted-foreground/70"> / </span>
            {formatDurationMmSs(totalFrames / FILM_FPS)}
          </span>
        ) : null}
      </div>
      <RenderFilmPreview
        assetBundle={assetBundle}
        scenes={previewScenes}
        frames={previewFrames}
        renders={renders}
        className="w-full shrink-0"
        filmPlayerRef={filmPlayerRef}
        globalFrame={filmGlobalFrame}
        onGlobalFrameChange={setFilmGlobalFrame}
        onPlayingChange={setFilmPlaying}
        playbackDisabled={!canPlayPreview}
        outsideCaption={outsideCaption}
      />
      {selectedScene ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground">
            Delay
            <input
              type="number"
              min={0}
              step={0.1}
              value={Number.isFinite(selectedScene.delaySeconds) ? selectedScene.delaySeconds ?? 0 : 0}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                patchScene(selectedScene.id, {
                  delaySeconds: Number.isFinite(v) && v > 0 ? v : undefined,
                });
              }}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground">
            Transition
            <select
              value={selectedScene.transition ?? "cut"}
              onChange={(e) =>
                patchScene(selectedScene.id, {
                  transition: e.target.value as Scene["transition"],
                })
              }
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
            >
              <option value="cut">Cut</option>
              <option value="fade">Fade</option>
              <option value="dissolve">Dissolve</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground">
            Fade sec
            <input
              type="number"
              min={0}
              step={0.1}
              value={Number.isFinite(selectedScene.transitionSeconds) ? selectedScene.transitionSeconds ?? 0 : 0}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                patchScene(selectedScene.id, {
                  transitionSeconds: Number.isFinite(v) && v > 0 ? v : undefined,
                });
              }}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
            />
          </label>
        </div>
      ) : null}
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
              {editingFrame.kind === "transition" ? "Transition" : "Keyframe"} {editingFrameIndex + 1}
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
              {frameHasOutputImage(editingFrame.src) ? (
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
              <label htmlFor="keyframe-editor-prompt" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/50 pt-5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                disabled={Boolean(renderingFrameIds[editingFrame.id])}
                onClick={() => void requestFrameRender(editingFrame.id)}
              >
                <Sparkles className="size-4" aria-hidden />
                {renderingFrameIds[editingFrame.id] ? "Generating…" : "Regenerate"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(renderingFrameIds[editingFrame.id])}
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
        <div className="shrink-0 px-4 py-2 md:px-6 md:py-2.5">
          <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div
              className="inline-flex w-fit max-w-full shrink-0 gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5"
              role="tablist"
              aria-label="Studio"
            >
              <Button
                type="button"
                role="tab"
                id="tab-studio-story"
                aria-selected={studioMode === "story"}
                variant={studioMode === "story" ? "secondary" : "ghost"}
                className="h-8 min-w-0 cursor-pointer gap-1.5 rounded-md px-3"
                onClick={() => setStudioMode("story")}
              >
                Story
              </Button>
              <Button
                type="button"
                role="tab"
                id="tab-studio-compose"
                aria-selected={studioMode === "film"}
                variant={studioMode === "film" ? "secondary" : "ghost"}
                className="h-8 min-w-0 cursor-pointer gap-1.5 rounded-md px-2.5 sm:px-3"
                onClick={() => setStudioMode("film")}
              >
                Compose
              </Button>
            </div>
            {studioMode === "film" ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void prepareScenes()}
                  disabled={preparingScenes || !project.prompt.trim()}
                  className="h-9 cursor-pointer gap-2 disabled:cursor-not-allowed"
                >
                  {preparingScenes ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-4 shrink-0" aria-hidden />
                  )}
                  {preparingScenes ? "Creating shots…" : "Create shots"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void createMissingKeyframeImages()}
                  disabled={
                    frames.length === 0 || renderingAllFrameImages || !hasAnyMissingFrameImage
                  }
                  className="h-9 cursor-pointer gap-2 disabled:cursor-not-allowed"
                >
                  {renderingAllFrameImages ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-4 shrink-0" aria-hidden />
                  )}
                  {renderingAllFrameImages ? "Creating keyframes…" : "Create keyframes"}
                </Button>
                {flowError ? (
                  <p className="min-w-0 text-sm text-destructive" role="alert">
                    {flowError}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 justify-end">
                <Button
                  type="button"
                  onClick={() => void onStoryNext()}
                  disabled={storyNextBusy}
                  className="h-9 cursor-pointer gap-1.5 disabled:cursor-not-allowed"
                >
                  {storyNextBusy ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  ) : null}
                  Next
                  <ChevronRight className="size-4 shrink-0" aria-hidden />
                </Button>
              </div>
            )}
          </div>
        </div>
        {studioMode === "story" ? (
          <WorkflowStepPage className="min-h-0 flex-1" primaryClassName="gap-6" panels={[scriptPanel]} />
        ) : (
          <WorkflowStepPage
            className="min-h-0 flex-1"
            primaryClassName="gap-4 bg-background md:px-4 lg:border-r lg:border-border/60 lg:pl-4 lg:pr-4"
            panels={[scenesAndKeyframesPanel, buildPanel]}
          />
        )}
      </div>
      {keyframeEditorModal}
    </>
  );
}
