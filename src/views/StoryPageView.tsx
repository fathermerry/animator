import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { SceneEdit } from "@/components/SceneEdit";
import { WorkflowStepPage } from "@/components/WorkflowStepPage";
import { formatDurationMmSs } from "@/lib/filmTime";
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
  const patchScene = useStore(useProjectStore, (s) => s.patchScene);

  const orderedScenes = useMemo(
    () => [...scenes].sort((a, b) => a.index - b.index),
    [scenes],
  );

  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);

  useEffect(() => {
    if (expandedSceneId && !orderedScenes.some((s) => s.id === expandedSceneId)) {
      setExpandedSceneId(null);
    }
  }, [orderedScenes, expandedSceneId]);

  const firstPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureDraft();
  }, [ensureDraft]);

  const text = project?.prompt ?? "";

  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [narrationErrorBySceneId, setNarrationErrorBySceneId] = useState<
    Record<string, string>
  >({});

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
      try {
        const { audioUrl } = await requestSceneNarration({
          projectId,
          sceneId: sc.id,
          text: vo,
        });
        patchScene(sc.id, { narrationAudioSrc: audioUrl });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Narration failed";
        setNarrationErrorBySceneId((prev) => ({ ...prev, [sc.id]: msg }));
      } finally {
        setGeneratingSceneId(null);
      }
    },
    [project?.id, patchScene],
  );

  return (
    <>
      <WorkflowStepPage
        firstPanelRef={firstPanelRef}
        primaryClassName="md:pr-0 lg:pr-0"
        panels={[
          <textarea
            key="script"
            value={text}
            onChange={(e) => setPromptText(e.target.value)}
            autoComplete="off"
            spellCheck
            placeholder="Start typing or paste a full script"
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
          />,
        <div key="story-right" className="flex w-full min-w-0 flex-col gap-6">
          <div className="flex w-full min-w-0 flex-col gap-2.5" aria-label="Scenes">
            <p className={panelHeadingAfterBlockClass}>Scenes</p>
            <ul className="flex min-w-0 flex-col gap-1">
              {orderedScenes.map((sc, i) => {
                const title = sc.title.trim() || `Scene ${sc.index + 1}`;
                const isExpanded = expandedSceneId === sc.id;
                const panelId = `story-scene-config-${sc.id}`;
                return (
                  <li key={sc.id} className="min-w-0">
                    <button
                      type="button"
                      id={`${panelId}-trigger`}
                      onClick={() =>
                        setExpandedSceneId((prev) => (prev === sc.id ? null : sc.id))
                      }
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
                        className="mt-1 mb-2 rounded-md border border-border/80 px-3 py-4"
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
        </div>,
        ]}
      />
    </>
  );
}
