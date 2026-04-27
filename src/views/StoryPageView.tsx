import { ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { frameHasOutputImage } from "@/lib/frameRenderStatus";
import { pathForProjectStep, navigate } from "@/router";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";

export function StoryPageView() {
  const project = useStore(useProjectStore, selectCurrentProject);
  const setPromptText = useStore(useProjectStore, (s) => s.setPromptText);
  const requestStoryCompose = useStore(useProjectStore, (s) => s.requestStoryCompose);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const renderingAllFrameImages = useStore(useProjectStore, (s) => s.renderingAllFrameImages);

  const orderedScenes = useMemo(() => [...scenes].sort((a, b) => a.index - b.index), [scenes]);
  const [preparingScenes, setPreparingScenes] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);

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

  const storyNextBusy = preparingScenes || renderingAllFrameImages;

  const onStoryNext = useCallback(async () => {
    setFlowError(null);
    if (project.prompt.trim() && orderedScenes.length === 0) {
      const composeOk = await prepareScenes();
      if (!composeOk) return;
    } else {
      const snap = useProjectStore.getState();
      const missing = snap.frames.some((f) => !frameHasOutputImage(f.src));
      if (snap.frames.length > 0 && !snap.renderingAllFrameImages && missing) {
        try {
          await snap.requestFullFilmRender();
        } catch (e: unknown) {
          setFlowError(e instanceof Error ? e.message : "Keyframe generation failed");
          return;
        }
      }
    }
    navigate(pathForProjectStep(project.id, "compose"));
  }, [project.id, project.prompt, orderedScenes.length, prepareScenes]);

  const goStory = useCallback(
    () => navigate(pathForProjectStep(project.id, "story")),
    [project.id],
  );
  const goCompose = useCallback(
    () => navigate(pathForProjectStep(project.id, "compose")),
    [project.id],
  );

  return (
    <div className="flex w-full min-w-0 flex-col">
      <header className="sticky top-0 z-10 shrink-0 py-2.5 md:py-3">
        <div className="flex w-full min-w-0 flex-col gap-2 px-4 md:px-6">
          <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div
              className="inline-flex w-fit max-w-full shrink-0 gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5"
              role="tablist"
              aria-label="Story and compose"
            >
              <Button
                type="button"
                role="tab"
                id="tab-story"
                aria-selected
                variant="secondary"
                className="h-8 min-w-0 cursor-pointer gap-1.5 rounded-md px-3"
                onClick={goStory}
              >
                Story
              </Button>
              <Button
                type="button"
                role="tab"
                id="tab-compose"
                aria-selected={false}
                variant="ghost"
                className="h-8 min-w-0 cursor-pointer gap-1.5 rounded-md px-2.5 sm:px-3"
                onClick={goCompose}
              >
                Compose
              </Button>
            </div>
            <div className="flex min-w-0 flex-1 justify-end">
              <Button
                type="button"
                onClick={() => void onStoryNext()}
                disabled={storyNextBusy}
                className="h-9 cursor-pointer gap-1.5 disabled:cursor-not-allowed"
              >
                {storyNextBusy ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
                Next
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </Button>
            </div>
          </div>
          {flowError ? (
            <p className="min-w-0 text-sm text-destructive" role="alert">
              {flowError}
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-10 md:px-8 md:pb-32 md:pt-14">
        <Textarea
          value={project.prompt}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Write a simple story..."
          className={cn(
            "min-h-[min(70vh,36rem)] w-full resize-none rounded-none border-0 bg-transparent px-0 py-1 text-left text-base leading-relaxed shadow-none",
            "text-foreground placeholder:text-muted-foreground/35",
            "focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent",
            "disabled:bg-transparent dark:disabled:bg-transparent",
          )}
          spellCheck
          aria-label="Story"
        />
      </main>
    </div>
  );
}
