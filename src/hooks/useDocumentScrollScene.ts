import { useCallback, useEffect, useRef, useState } from "react";

function readScrollProgress(): number {
  const el = document.documentElement;
  const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
  if (maxScroll <= 0) return 0;
  return Math.min(1, Math.max(0, el.scrollTop / maxScroll));
}

function progressToSceneIndex(p: number, sceneCount: number): number {
  if (sceneCount <= 0) return 0;
  return Math.min(sceneCount - 1, Math.floor(p * sceneCount));
}

const TOP_EPS = 0.5;

/**
 * Observes document scroll and publishes scroll progress [0,1] and a discrete scene index
 * (N equal buckets). Choosing a scene scrolls the window to the top and pins that index
 * until the user scrolls away from the top.
 */
export function useDocumentScrollScene(sceneCount: number) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const pinnedSceneIndexRef = useRef<number | null>(null);

  const update = useCallback(() => {
    const el = document.documentElement;
    const p = readScrollProgress();
    const top = el.scrollTop;
    setScrollProgress(p);

    if (sceneCount <= 0) {
      pinnedSceneIndexRef.current = null;
      setActiveSceneIndex(0);
      return;
    }

    if (pinnedSceneIndexRef.current !== null && top <= TOP_EPS) {
      const idx = Math.min(
        sceneCount - 1,
        Math.max(0, pinnedSceneIndexRef.current),
      );
      pinnedSceneIndexRef.current = idx;
      setActiveSceneIndex(idx);
      return;
    }

    if (top > TOP_EPS) {
      pinnedSceneIndexRef.current = null;
    }
    setActiveSceneIndex(progressToSceneIndex(p, sceneCount));
  }, [sceneCount]);

  useEffect(() => {
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(() => update());
    if (document.body) ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [update]);

  const scrollToSceneIndex = useCallback(
    (k: number) => {
      if (sceneCount <= 0) return;
      const clamped = Math.max(0, Math.min(sceneCount - 1, k));
      pinnedSceneIndexRef.current = clamped;
      setActiveSceneIndex(clamped);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [sceneCount],
  );

  return { scrollProgress, activeSceneIndex, scrollToSceneIndex };
}
