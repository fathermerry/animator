import type { PlayerRef } from "@remotion/player";
import { useCallback, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { RenderActivityFloatingDock } from "@/components/RenderActivityFloatingDock";
import { RenderFilmPreview } from "@/components/RenderFilmPreview";
import { RenderSceneFrameDetails } from "@/components/RenderSceneFrameDetails";
import { RenderSceneLayers } from "@/components/RenderSceneLayers";
import { WorkflowPreviewColumn } from "@/components/WorkflowPreviewColumn";
import { WorkflowStepPage } from "@/components/WorkflowStepPage";
import { formatDurationMmSs } from "@/lib/filmTime";
import { panelHeadingClass } from "@/lib/panelHeading";
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

/** Compose step: scene/frame breakdown; preview matches Script/Style. */
export function ComposePageView({ step: _step }: Props) {
  const assetBundle = useStore(useProjectStore, selectResolvedStyleBundle);
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
      setFilmGlobalFrame(idx);
    },
    [scenes, frames, renders, assetBundle],
  );

  return (
    <WorkflowStepPage
      middle={
        <RenderSceneFrameDetails
          scene={editScene}
          frame={editFrame}
          onPatchScene={patchScene}
          onPatchFrame={patchFrame}
          className="gap-4"
        />
      }
      primary={
        <aside
          className={cn(
            "flex w-full min-w-0 flex-col pb-4 lg:pb-0",
            "lg:w-[16rem] lg:shrink-0 lg:pr-4",
          )}
          aria-label="Scene layers"
        >
          <p className={cn(panelHeadingClass, "mb-2")}>Layers</p>
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
          <RenderActivityFloatingDock
            renders={renders}
            scenes={scenes}
            frames={frames}
          />
        </>
      }
      />
  );
}
