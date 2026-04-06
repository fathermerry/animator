import { useEffect, useState } from "react";

function resolveAudioUrl(src: string): string {
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

/** One-shot metadata read (e.g. right after narration generation when SceneEdit is not mounted). */
export function loadAudioDurationSeconds(src: string): Promise<number | undefined> {
  const raw = src.trim();
  if (!raw) return Promise.resolve(undefined);
  const url = resolveAudioUrl(raw);
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    const finish = (d: number | undefined) => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("error", onErr);
      resolve(d);
    };
    const onMeta = () => {
      const d = a.duration;
      finish(Number.isFinite(d) && d > 0 ? d : undefined);
    };
    const onErr = () => finish(undefined);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("error", onErr);
    a.src = url;
    a.load();
  });
}

/** Loaded duration in seconds, or `undefined` while loading / no src / error. */
export function useNarrationAudioDuration(src: string | undefined | null): number | undefined {
  const [duration, setDuration] = useState<number | undefined>();

  useEffect(() => {
    const raw = src?.trim();
    if (!raw) {
      setDuration(undefined);
      return;
    }
    const url = resolveAudioUrl(raw);
    const a = document.createElement("audio");
    a.preload = "metadata";
    const onMeta = () => {
      const d = a.duration;
      setDuration(Number.isFinite(d) && d > 0 ? d : undefined);
    };
    const onErr = () => setDuration(undefined);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("error", onErr);
    a.src = url;
    a.load();
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("error", onErr);
      a.removeAttribute("src");
      a.load();
    };
  }, [src]);

  return duration;
}
