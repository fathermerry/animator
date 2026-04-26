import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CombinedNarrationPreview } from "@/components/CombinedNarrationPreview";
import { SceneEdit } from "@/components/SceneEdit";
import { WorkflowStepPage } from "@/components/WorkflowStepPage";
import { formatDurationMmSs } from "@/lib/filmTime";
import { loadAudioDurationSeconds } from "@/lib/useNarrationAudioDuration";
import { requestSceneNarration } from "@/lib/narrationApi";
import { panelHeadingAfterBlockClass } from "@/lib/panelHeading";
import { cn } from "@/lib/utils";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";
import type { Step } from "@/steps";
import type { Scene } from "@/types/project";

type Props = { step: Step };

export function StoryPageView({ step: _step }: Props) {
  const project = useStore(useProjectStore, selectCurrentProject);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const ensureDraft = useStore(useProjectStore, (s) => s.ensureDraftProject);
  const setPromptText = useStore(useProjectStore, (s) => s.setPromptText);
  const setScriptText = useStore(useProjectStore, (s) => s.setScriptText);
  const generateScript = useStore(useProjectStore, (s) => s.requestScriptGeneration);
  const patchScene = useStore(useProjectStore, (s) => s.patchScene);
  const requestStoryCompose = useStore(useProjectStore, (s) => s.requestStoryCompose);
  const addNarrationRender = useStore(useProjectStore, (s) => s.addNarrationRender);

  const orderedScenes = useMemo(
    () => [...scenes].sort((a, b) => a.index - b.index),
    [scenes],
  );

  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);

  useEffect(() => {
    setExpandedSceneId((prev) => {
      if (orderedScenes.length === 0) return null;
      if (prev && orderedScenes.some((s) => s.id === prev)) return prev;
      return orderedScenes[0]!.id;
    });
  }, [orderedScenes]);

  const firstPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureDraft();
  }, [ensureDraft]);

  const text = project?.prompt ?? "";
  const script = project?.script ?? "";

  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [storyMode, setStoryMode] = useState<"story" | "script">("story");
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [composingStory, setComposingStory] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [narrationErrorBySceneId, setNarrationErrorBySceneId] = useState<
    Record<string, string>
  >({});

  const onGenerateScript = useCallback(async () => {
    if (generatingScript || !text.trim()) return;
    setScriptError(null);
    setGeneratingScript(true);
    try {
      await generateScript();
      setStoryMode("script");
    } catch (e: unknown) {
      setScriptError(e instanceof Error ? e.message : "Script generation failed");
    } finally {
      setGeneratingScript(false);
    }
  }, [generateScript, generatingScript, text]);

  const composeStory = useCallback(async () => {
    if (composingStory || !(script.trim() || text.trim())) return;
    setComposeError(null);
    setComposingStory(true);
    try {
      await requestStoryCompose();
    } catch (e: unknown) {
      setComposeError(e instanceof Error ? e.message : "Story compose failed");
    } finally {
      setComposingStory(false);
    }
  }, [composingStory, requestStoryCompose, script, text]);

  const generateNarrationForScene = useCallback(
    async (sc: Scene) => {
      const projectId = project?.id;
      if (!projectId) return;
      const vo = sc.voiceoverText?.trim();
      if (!vo) return;
      setNarrationErrorBySceneId((prev) => {
        const next = { ...prev };
        delete next[sc.id];
        return next;
      });
      setGeneratingSceneId(sc.id);
      const startedAt = new Date();
      try {
        const { audioUrl, model, cost } = await requestSceneNarration({
          projectId,
          sceneId: sc.id,
          text: vo,
        });
        addNarrationRender(sc.id, model, cost, startedAt);
        patchScene(sc.id, { narrationAudioSrc: audioUrl });
        void loadAudioDurationSeconds(audioUrl).then((d) => {
          if (d != null) patchScene(sc.id, { durationSeconds: Math.ceil(d) });
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Narration failed";
        setNarrationErrorBySceneId((prev) => ({ ...prev, [sc.id]: msg }));
      } finally {
        setGeneratingSceneId(null);
      }
    },
    [project?.id, patchScene, addNarrationRender],
  );

  return (
    <>
      <WorkflowStepPage
        firstPanelRef={firstPanelRef}
        primaryClassName="md:pr-0 lg:pr-0"
        panels={[
          <div key="script" className="flex min-h-0 w-full min-w-0 flex-col gap-3">
            <div className="inline-flex w-fit rounded-lg border border-border/80 bg-muted/30 p-0.5">
              {(["story", "script"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStoryMode(mode)}
                  className={cn(
                    "h-8 cursor-pointer rounded-md px-3 text-base transition-colors",
                    storyMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={storyMode === mode}
                >
                  {mode === "story" ? "Story" : "Script"}
                </button>
              ))}
            </div>
            {storyMode === "story" ? (
              <textarea
                value={text}
                onChange={(e) => setPromptText(e.target.value)}
                autoComplete="off"
                spellCheck
                placeholder="Start with a simple story"
                className={cn(
                  "min-h-[min(28rem,55svh)] w-full min-w-0 resize-none bg-transparent",
                  "[field-sizing:content]",
                  "border-0 p-0 text-left shadow-none outline-none ring-0 md:pr-8 lg:pr-6",
                  "focus-visible:ring-0",
                  "placeholder:text-muted-foreground/35",
                  "leading-relaxed text-foreground",
                  "[mask-image:linear-gradient(to_bottom,transparent,black_1.125rem,black_calc(100%-1.125rem),transparent)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_1.125rem,black_calc(100%-1.125rem),transparent)] [mask-size:100%_100%] [-webkit-mask-size:100%_100%]",
                )}
                aria-label="Story"
              />
            ) : (
              <textarea
                value={script}
                onChange={(e) => setScriptText(e.target.value)}
                autoComplete="off"
                spellCheck
                placeholder="Generate a script from the story, then tune it here"
                className={cn(
                  "min-h-[min(28rem,55svh)] w-full min-w-0 resize-none bg-transparent",
                  "[field-sizing:content]",
                  "border-0 p-0 text-left shadow-none outline-none ring-0 md:pr-8 lg:pr-6",
                  "focus-visible:ring-0",
                  "placeholder:text-muted-foreground/35",
                  "leading-relaxed text-foreground",
                  "[mask-image:linear-gradient(to_bottom,transparent,black_1.125rem,black_calc(100%-1.125rem),transparent)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_1.125rem,black_calc(100%-1.125rem),transparent)] [mask-size:100%_100%] [-webkit-mask-size:100%_100%]",
                )}
                aria-label="Script"
              />
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void onGenerateScript()}
                disabled={generatingScript || !text.trim()}
                className="h-9 gap-2"
              >
                <Sparkles className="size-4" aria-hidden />
                {generatingScript ? "Writing..." : "Write script"}
              </Button>
              <Button
                type="button"
                onClick={() => void composeStory()}
                disabled={composingStory || !(script.trim() || text.trim())}
                className="h-9 gap-2"
              >
                <Sparkles className="size-4" aria-hidden />
                {composingStory ? "Preparing..." : "Confirm script"}
              </Button>
              {scriptError ? (
                <p className="text-sm text-destructive" role="alert">
                  {scriptError}
                </p>
              ) : null}
              {composeError ? (
                <p className="text-sm text-destructive" role="alert">
                  {composeError}
                </p>
              ) : null}
            </div>
          </div>,
        <div key="story-right" className="flex w-full min-w-0 flex-col gap-6">
          {orderedScenes.length > 0 ? (
            <>
              <div className="flex w-full min-w-0 flex-col gap-2" aria-label="Audio preview">
                <p className={panelHeadingAfterBlockClass}>Audio preview</p>
                <CombinedNarrationPreview scenes={orderedScenes} />
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2.5" aria-label="Shots">
                <p className={panelHeadingAfterBlockClass}>Shots</p>
                <ul className="flex min-w-0 flex-col gap-1">
                  {orderedScenes.map((sc, i) => {
                    const title = sc.title.trim() || `Shot ${sc.index + 1}`;
                    const isExpanded = expandedSceneId === sc.id;
                    const panelId = `story-scene-config-${sc.id}`;
                    return (
                      <li key={sc.id} className="min-w-0">
                        <button
                          type="button"
                          id={`${panelId}-trigger`}
                          onClick={() => setExpandedSceneId(sc.id)}
                          className={cn(
                            "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-base leading-none transition-colors",
                            isExpanded
                              ? "bg-muted/80 text-foreground"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          )}
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                        >
                          <span className="w-6 shrink-0 text-center text-[13px] tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{title}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatDurationMmSs(sc.durationSeconds)}
                          </span>
                        </button>
                        {isExpanded ? (
                          <div
                            id={panelId}
                            role="region"
                            aria-labelledby={`${panelId}-trigger`}
                            className="mt-1 mb-2 px-3 pb-4"
                          >
                            <SceneEdit
                              variant="inline"
                              scene={sc}
                              disabled={!project?.id}
                              onVoiceoverChange={(value) => {
                                patchScene(sc.id, { voiceoverText: value });
                              }}
                              onDurationChange={(durationSeconds) => {
                                patchScene(sc.id, { durationSeconds });
                              }}
                              onGenerateAudio={() => void generateNarrationForScene(sc)}
                              generatingAudio={generatingSceneId === sc.id}
                              narrationError={narrationErrorBySceneId[sc.id] ?? null}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : (
            <div className="flex min-h-[12rem] flex-col justify-start gap-3 rounded-lg border border-dotted border-muted-foreground/35 bg-muted/15 px-4 py-5">
              <p className={panelHeadingAfterBlockClass}>Film</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                This project only has your story for now. Open{" "}
                <span className="font-medium text-foreground">Studio</span> and run{" "}
                <span className="font-medium text-foreground">Create shots</span> under the story
                column when you want narration and visuals broken out.
              </p>
            </div>
          )}
        </div>,
        ]}
      />
    </>
  );
}
