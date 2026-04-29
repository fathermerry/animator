import { useCallback, useMemo, useState } from "react";
import { useStore } from "zustand/react";

import { frameHasOutputImage } from "@/lib/frameRenderStatus";
import { pathForProjectStep, navigate } from "@/router";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";

export function useStoryNextActions() {
  const project = useStore(useProjectStore, selectCurrentProject);
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

  const onStoryNext = useCallback(() => {
    setFlowError(null);
    navigate(pathForProjectStep(project.id, "compose"));

    void (async () => {
      if (project.prompt.trim() && orderedScenes.length === 0) {
        const composeOk = await prepareScenes();
        if (!composeOk) return;
        return;
      }
      const snap = useProjectStore.getState();
      const missing = snap.frames.some((f) => !frameHasOutputImage(f.src));
      if (snap.frames.length > 0 && !snap.renderingAllFrameImages && missing) {
        try {
          await snap.requestFullFilmRender();
        } catch (e: unknown) {
          setFlowError(e instanceof Error ? e.message : "Keyframe generation failed");
        }
      }
    })();
  }, [project.id, project.prompt, orderedScenes.length, prepareScenes]);

  return { flowError, onStoryNext, storyNextBusy };
}
