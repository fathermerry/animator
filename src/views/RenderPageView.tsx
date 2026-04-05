import type { PlayerRef } from "@remotion/player";
import { useCallback, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

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
import { selectResolvedAssetBundle, useProjectStore } from "@/store/projectStore";
import type { Step } from "@/steps";

type Props = { step: Step };

/** Render step: scene/frame breakdown; preview matches Story/Assets. */
export function RenderPageView({ step: _step }: Props) {
  const assetBundle = useStore(useProjectStore, selectResolvedAssetBundle);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const frames = useStore(useProjectStore, (s) => s.frames);
  const renders = useStore(useProjectStore, (s) => s.renders);
  const patchScene = useStore(useProjectStore, (s) => s.patchScene);
  const patchFrame = useStore(useProjectStore, (s) => s.patchFrame);

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
    },
    [scenes, frames, renders, assetBundle],
  );

  return (
    <WorkflowStepLayout
      className="py-2 md:py-3 lg:py-4"
      primaryClassName="pt-0 pl-3 md:px-5 md:pt-0 lg:pl-4 lg:pt-1 lg:pr-6"
      middle={
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background pb-4">
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
        <div className="flex w-full min-w-0 flex-col lg:min-h-0 lg:flex-row lg:items-stretch">
          <aside
            className={cn(
              "flex w-full flex-col pb-4 lg:pb-0",
              "lg:sticky lg:top-14 lg:w-[16rem] lg:shrink-0 lg:pr-4",
            )}
            aria-label="Scene layers"
          >
            <div className="mb-2 min-w-0">
              <p className="text-xs font-medium uppercase text-muted-foreground">Layers</p>
            </div>
            <RenderSceneLayers
              variant="sidebar"
              scenes={scenes}
              frames={frames}
              renders={renders}
              className="w-full min-w-0"
              playbackActiveFrameId={playbackActiveFrameId}
              onFrameSeek={seekFilmToFrame}
            />
          </aside>
          <div className="min-h-0 min-w-0 flex-1" aria-hidden />
        </div>
      }
      preview={
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
            onGlobalFrameChange={setFilmGlobalFrame}
          />
        </WorkflowPreviewColumn>
      }
    />
  );
}
