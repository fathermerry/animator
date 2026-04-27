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
  const lastElapsedRef = useRef<number | null>(null);

  useEffect(() => {
    startedPlaybackRef.current = false;
    lastElapsedRef.current = null;
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
    const elapsed = playbackWithin.elapsedInSceneSeconds;

    const apply = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const target = ratio * audio.duration;
      const desiredPlaybackRate =
        playbackWithin.sceneFilmDurationSeconds > 0
          ? audio.duration / playbackWithin.sceneFilmDurationSeconds
          : 1;
      audio.playbackRate =
        Number.isFinite(desiredPlaybackRate) && desiredPlaybackRate > 0
          ? Math.min(4, Math.max(0.25, desiredPlaybackRate))
          : 1;

      if (!filmPlaying) {
        startedPlaybackRef.current = false;
        lastElapsedRef.current = elapsed;
        if (Math.abs(audio.currentTime - target) > 0.02) audio.currentTime = target;
        audio.pause();
        return;
      }

      const lastElapsed = lastElapsedRef.current;
      const jumped =
        lastElapsed != null &&
        Math.abs(elapsed - lastElapsed - 1 / 30) > 0.35;
      lastElapsedRef.current = elapsed;

      if (!startedPlaybackRef.current) {
        startedPlaybackRef.current = true;
        if (Math.abs(audio.currentTime - target) > 0.12) audio.currentTime = target;
        void audio.play().catch(() => {});
      } else if (jumped && Math.abs(audio.currentTime - target) > 0.12) {
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
