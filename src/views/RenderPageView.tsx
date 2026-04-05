import type { PlayerRef } from "@remotion/player";
import { Clapperboard } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
import { RenderFilmPreview } from "@/components/RenderFilmPreview";
import { RenderSceneFrameDetails } from "@/components/RenderSceneFrameDetails";
import { RenderSceneLayers } from "@/components/RenderSceneLayers";
import { WorkflowPreviewColumn } from "@/components/WorkflowPreviewColumn";
import { WorkflowStepLayout } from "@/components/WorkflowStepLayout";
import { formatDurationMmSs } from "@/lib/filmTime";
import {
  buildRenderFilmTimeline,
  FILM_FPS,
  getFilmStartFrameIndexForFrame,
  getFrameIdAtFilmGlobalFrame,
  getPlaybackContextAtFilmGlobalFrame,
} from "@/lib/renderFilmTimeline";
import { cn } from "@/lib/utils";
import { selectResolvedStyleBundle, useProjectStore } from "@/store/projectStore";
import type { Step } from "@/steps";

type Props = { step: Step };

/** Render step: scene/frame breakdown; preview matches Script/Style. */
export function RenderPageView({ step: _step }: Props) {
  const assetBundle = useStore(useProjectStore, selectResolvedStyleBundle);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const frames = useStore(useProjectStore, (s) => s.frames);
  const renders = useStore(useProjectStore, (s) => s.renders);
  const patchScene = useStore(useProjectStore, (s) => s.patchScene);
  const patchFrame = useStore(useProjectStore, (s) => s.patchFrame);
  const requestFullFilmRender = useStore(useProjectStore, (s) => s.requestFullFilmRender);
  const renderingFrameIds = useStore(useProjectStore, (s) => s.renderingFrameIds);

  const filmPlayerRef = useRef<PlayerRef>(null);
  const [filmGlobalFrame, setFilmGlobalFrame] = useState(0);

  const playbackActiveFrameId = useMemo(
    () => getFrameIdAtFilmGlobalFrame(filmGlobalFrame, scenes, frames, renders, assetBundle),
    [filmGlobalFrame, scenes, frames, renders, assetBundle],
  );

  const { sceneId: editSceneId, frameId: editFrameId } = useMemo(
    () => getPlaybackContextAtFilmGlobalFrame(filmGlobalFrame, scenes, frames, renders, assetBundle),
    [filmGlobalFrame, scenes, frames, renders, assetBundle],
  );

  const editScene = useMemo(
    () => (editSceneId ? scenes.find((s) => s.id === editSceneId) ?? null : null),
    [editSceneId, scenes],
  );

  const editFrame = useMemo(
    () => (editFrameId ? frames.find((f) => f.id === editFrameId) ?? null : null),
    [editFrameId, frames],
  );

  const { totalFrames } = useMemo(
    () => buildRenderFilmTimeline(scenes, frames, renders, assetBundle),
    [scenes, frames, renders, assetBundle],
  );

  const seekFilmToFrame = useCallback(
    (frameId: string) => {
      const idx = getFilmStartFrameIndexForFrame(frameId, scenes, frames, renders, assetBundle);
      if (idx == null) return;
      filmPlayerRef.current?.seekTo(idx);
      setFilmGlobalFrame(idx);
    },
    [scenes, frames, renders, assetBundle],
  );

  const allFramesRendering =
    frames.length > 0 && frames.every((f) => Boolean(renderingFrameIds[f.id]));

  return (
    <WorkflowStepLayout
      className="py-2 md:py-3 lg:py-4"
      primaryClassName="pl-3 md:px-5 lg:pl-4"
      middle={
        <div className="w-full min-w-0 bg-background pb-4 lg:sticky lg:top-20 lg:z-10 lg:self-start">
          <RenderSceneFrameDetails
            scene={editScene}
            frame={editFrame}
            onPatchScene={patchScene}
            onPatchFrame={patchFrame}
            className="min-h-0"
          />
        </div>
      }
      primary={
        <aside
          className={cn(
            "flex w-full min-w-0 flex-col pb-4 lg:pb-0",
            "lg:sticky lg:top-14 lg:w-[16rem] lg:shrink-0 lg:pr-4",
          )}
          aria-label="Scene layers"
        >
          <div className="mb-2 min-w-0">
            <div className="flex min-h-[1.25rem] min-w-0 items-center">
              <p className="text-xs font-medium uppercase text-muted-foreground">Layers</p>
            </div>
          </div>
          <RenderSceneLayers
            variant="sidebar"
            scenes={scenes}
            frames={frames}
            renders={renders}
            assetBundle={assetBundle}
            className="w-full min-w-0"
            playbackActiveFrameId={playbackActiveFrameId}
            onFrameSeek={seekFilmToFrame}
          />
        </aside>
      }
      preview={
        <>
          <WorkflowPreviewColumn
            headerRight={
              totalFrames > 0 ? (
                <>
                  {formatDurationMmSs(filmGlobalFrame / FILM_FPS)}
                  <span className="text-muted-foreground/70"> / </span>
                  {formatDurationMmSs(totalFrames / FILM_FPS)}
                </>
              ) : null
            }
          >
            <RenderFilmPreview
              assetBundle={assetBundle}
              scenes={scenes}
              frames={frames}
              renders={renders}
              className="w-full shrink-0"
              filmPlayerRef={filmPlayerRef}
              globalFrame={filmGlobalFrame}
              onGlobalFrameChange={setFilmGlobalFrame}
            />
          </WorkflowPreviewColumn>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="fixed bottom-6 right-6 z-30 gap-1.5 shadow-md"
            disabled={frames.length === 0 || allFramesRendering}
            aria-label="Render all frames at once"
            onClick={() => requestFullFilmRender()}
          >
            <Clapperboard className="size-4" strokeWidth={2} aria-hidden />
            Render all
          </Button>
        </>
      }
    />
  );
}
