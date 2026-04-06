import type { PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

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
  getFilmPlaybackWithinScene,
  getFilmStartFrameIndexForFrame,
  getFrameIdAtFilmGlobalFrame,
  getPlaybackContextAtFilmGlobalFrame,
} from "@/lib/renderFilmTimeline";
import { cn } from "@/lib/utils";
import { selectResolvedStyleBundle, useProjectStore } from "@/store/projectStore";
import type { Step } from "@/steps";

type Props = { step: Step };

/** Compose step: scene/frame breakdown; preview matches Story/Style. */
export function ComposePageView({ step: _step }: Props) {
  const assetBundle = useStore(useProjectStore, selectResolvedStyleBundle);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const frames = useStore(useProjectStore, (s) => s.frames);
  const renders = useStore(useProjectStore, (s) => s.renders);
  const patchScene = useStore(useProjectStore, (s) => s.patchScene);
  const patchFrame = useStore(useProjectStore, (s) => s.patchFrame);

  const filmPlayerRef = useRef<PlayerRef>(null);
  const [filmGlobalFrame, setFilmGlobalFrame] = useState(0);
  const [filmPlaying, setFilmPlaying] = useState(false);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);

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

  const playbackWithin = useMemo(
    () => getFilmPlaybackWithinScene(filmGlobalFrame, scenes, frames, renders, assetBundle),
    [filmGlobalFrame, scenes, frames, renders, assetBundle],
  );

  const narrationSrc = editScene?.narrationAudioSrc?.trim() ?? "";

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

  useEffect(() => {
    const audio = narrationAudioRef.current;
    if (!audio || !narrationSrc || !playbackWithin) return;
    const ratio =
      playbackWithin.sceneFilmDurationSeconds > 0
        ? Math.min(
            1,
            Math.max(0, playbackWithin.elapsedInSceneSeconds / playbackWithin.sceneFilmDurationSeconds),
          )
        : 0;
    const apply = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const target = ratio * audio.duration;
      if (Math.abs(audio.currentTime - target) > 0.12) {
        audio.currentTime = target;
      }
      if (filmPlaying) {
        void audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    };
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      apply();
    } else {
      audio.addEventListener("loadeddata", apply, { once: true });
    }
  }, [filmGlobalFrame, narrationSrc, playbackWithin, filmPlaying]);

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
    <>
      <WorkflowStepPage
        panels={[
        <aside
          key="layers"
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
        </aside>,
        <RenderSceneFrameDetails
          key="details"
          scene={editScene}
          frame={editFrame}
          onPatchScene={patchScene}
          onPatchFrame={patchFrame}
          className="gap-4"
        />,
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
            onPlayingChange={setFilmPlaying}
          />
          <p className="mt-2 min-w-0 text-sm leading-relaxed text-muted-foreground">
            {editScene?.voiceoverText?.trim()
              ? editScene.voiceoverText.trim()
              : "No voiceover for this scene."}
          </p>
          <audio ref={narrationAudioRef} className="hidden" preload="auto" aria-hidden />
        </WorkflowPreviewColumn>,
        ]}
      />
    </>
  );
}
