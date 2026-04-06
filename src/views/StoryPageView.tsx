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

  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSceneId && !orderedScenes.some((s) => s.id === selectedSceneId)) {
      setSelectedSceneId(null);
    }
  }, [orderedScenes, selectedSceneId]);

  const selectedScene = useMemo(
    () => (selectedSceneId ? orderedScenes.find((s) => s.id === selectedSceneId) ?? null : null),
    [orderedScenes, selectedSceneId],
  );

  const firstPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureDraft();
  }, [ensureDraft]);

  const text = project?.prompt ?? "";

  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [narrationError, setNarrationError] = useState<string | null>(null);

  const generateNarrationForScene = useCallback(
    async (sc: Scene) => {
      const projectId = project?.id;
      if (!projectId) return;
      const vo = sc.voiceoverText?.trim();
      if (!vo) {
        setNarrationError("Add transcript text for this scene first.");
        return;
      }
      setNarrationError(null);
      setGeneratingSceneId(sc.id);
      try {
        const { audioUrl } = await requestSceneNarration({
          projectId,
          sceneId: sc.id,
          text: vo,
        });
        patchScene(sc.id, { narrationAudioSrc: audioUrl });
      } catch (e: unknown) {
        setNarrationError(e instanceof Error ? e.message : "Narration failed");
      } finally {
        setGeneratingSceneId(null);
      }
    },
    [project?.id, patchScene],
  );

  const generateAllNarration = useCallback(async () => {
    const projectId = project?.id;
    if (!projectId) return;
    setNarrationError(null);
    setGeneratingAll(true);
    try {
      for (const sc of orderedScenes) {
        const vo = sc.voiceoverText?.trim();
        if (!vo) continue;
        const { audioUrl } = await requestSceneNarration({
          projectId,
          sceneId: sc.id,
          text: vo,
        });
        patchScene(sc.id, { narrationAudioSrc: audioUrl });
      }
    } catch (e: unknown) {
      setNarrationError(e instanceof Error ? e.message : "Narration failed");
    } finally {
      setGeneratingAll(false);
    }
  }, [orderedScenes, project?.id, patchScene]);

  const onGenerateThis = useCallback(() => {
    if (selectedScene) void generateNarrationForScene(selectedScene);
  }, [selectedScene, generateNarrationForScene]);

  return (
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
                const isSelected = selectedSceneId === sc.id;
                return (
                  <li key={sc.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedSceneId(sc.id)}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-base leading-none transition-colors",
                        isSelected
                          ? "bg-muted/80 text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                      aria-pressed={isSelected}
                    >
                      <span className="w-6 shrink-0 text-center text-[13px] tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{title}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatDurationMmSs(sc.durationSeconds)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <SceneEdit
            scene={selectedScene}
            disabled={!project?.id}
            generatingAll={generatingAll}
            generatingThis={generatingSceneId === selectedScene?.id}
            narrationError={narrationError}
            onVoiceoverChange={(value) => {
              if (selectedScene) patchScene(selectedScene.id, { voiceoverText: value });
            }}
            onGenerateThis={onGenerateThis}
            onGenerateAll={() => void generateAllNarration()}
          />
        </div>,
      ]}
    />
  );
}
