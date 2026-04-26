import { useEffect, useRef, type RefObject } from "react";

export type FilmPlaybackWithinScene = {
  elapsedInSceneSeconds: number;
  sceneFilmDurationSeconds: number;
};

/**
 * Keeps a hidden `<audio>` element aligned with the film playhead without calling `play()` every frame.
 */
export function useNarrationFilmSync(
  audioRef: RefObject<HTMLAudioElement | null>,
  narrationSrc: string,
  playbackWithin: FilmPlaybackWithinScene | null,
  filmGlobalFrame: number,
  filmPlaying: boolean,
): void {
  const startedPlaybackRef = useRef(false);

  useEffect(() => {
    startedPlaybackRef.current = false;
  }, [narrationSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !narrationSrc.trim()) return;
    if (!playbackWithin) {
      startedPlaybackRef.current = false;
      audio.pause();
      return;
    }

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

      if (!filmPlaying) {
        startedPlaybackRef.current = false;
        if (Math.abs(audio.currentTime - target) > 0.02) audio.currentTime = target;
        audio.pause();
        return;
      }

      if (!startedPlaybackRef.current) {
        startedPlaybackRef.current = true;
        if (Math.abs(audio.currentTime - target) > 0.12) audio.currentTime = target;
        void audio.play().catch(() => {});
      } else if (Math.abs(audio.currentTime - target) > 0.4) {
        audio.currentTime = target;
      }
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      apply();
    } else {
      audio.addEventListener("loadeddata", apply, { once: true });
    }
  }, [filmGlobalFrame, filmPlaying, narrationSrc, playbackWithin]); // audioRef intentionally omitted (stable)
}
