import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand/react";

import { ScriptScenePreview } from "@/components/ScriptScenePreview";
import { WorkflowPreviewColumn } from "@/components/WorkflowPreviewColumn";
import { WorkflowStepPage } from "@/components/WorkflowStepPage";
import { useDocumentScrollScene } from "@/hooks/useDocumentScrollScene";
import { formatDurationMmSs } from "@/lib/filmTime";
import { panelHeadingAfterBlockClass } from "@/lib/panelHeading";
import { cn } from "@/lib/utils";
import {
  selectCurrentProject,
  selectResolvedStyleBundle,
  useProjectStore,
} from "@/store/projectStore";
import type { Step } from "@/steps";
import type { Scene } from "@/types/project";

type Props = { step: Step };

export function ScriptPageView({ step: _step }: Props) {
  const project = useStore(useProjectStore, selectCurrentProject);
  const assetBundle = useStore(useProjectStore, selectResolvedStyleBundle);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const ensureDraft = useStore(useProjectStore, (s) => s.ensureDraftProject);
  const setPromptText = useStore(useProjectStore, (s) => s.setPromptText);
  const patchScene = useStore(useProjectStore, (s) => s.patchScene);

  const orderedScenes = useMemo(
    () => [...scenes].sort((a, b) => a.index - b.index),
    [scenes],
  );
  const sceneCount = orderedScenes.length;

  const primaryScrollRef = useRef<HTMLDivElement>(null);
  const { scrollProgress, activeSceneIndex, scrollToSceneIndex } =
    useDocumentScrollScene(sceneCount, { scrollRootRef: primaryScrollRef });

  const activeScene: Scene | null =
    sceneCount > 0 ? orderedScenes[Math.min(activeSceneIndex, sceneCount - 1)]! : null;

  useEffect(() => {
    ensureDraft();
  }, [ensureDraft]);

  const text = project?.prompt ?? "";

  return (
    <WorkflowStepPage
      primaryColumnRef={primaryScrollRef}
      primaryClassName="md:pr-0 lg:pr-0"
      primary={
        <textarea
          value={text}
          onChange={(e) => setPromptText(e.target.value)}
          autoComplete="off"
          spellCheck
          placeholder="Start typing"
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
      }
      preview={
        <WorkflowPreviewColumn>
          <ScriptScenePreview
            assetBundle={assetBundle}
            scene={activeScene}
            onDescriptionChange={(value) => {
              if (activeScene) patchScene(activeScene.id, { description: value });
            }}
            className="w-full"
          />
          <div className="flex w-full min-w-0 flex-col gap-2.5" aria-label="Scenes">
            <p className={panelHeadingAfterBlockClass}>Scenes</p>
            <p className="sr-only" aria-live="polite">
              Scroll progress {(scrollProgress * 100).toFixed(0)} percent; active scene{" "}
              {activeSceneIndex + 1} of {Math.max(sceneCount, 1)}
            </p>
            <ul className="flex min-w-0 flex-col gap-1">
              {orderedScenes.map((sc, i) => {
                const title = sc.title.trim() || `Scene ${sc.index + 1}`;
                return (
                  <li key={sc.id} className="min-w-0">
                    <div
                      className={cn(
                        "rounded-md transition-colors",
                        i === activeSceneIndex
                          ? "bg-muted/80"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => scrollToSceneIndex(i)}
                        className={cn(
                          "flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-base leading-none",
                          i === activeSceneIndex ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span className="w-6 shrink-0 text-center text-[13px] tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{title}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {formatDurationMmSs(sc.durationSeconds)}
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </WorkflowPreviewColumn>
      }
    />
  );
}
