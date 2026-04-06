import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

function readScrollProgress(scrollRoot: HTMLElement | null): number {
  const el =
    scrollRoot && scrollRoot.scrollHeight > scrollRoot.clientHeight + 1
      ? scrollRoot
      : document.documentElement;
  const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
  if (maxScroll <= 0) return 0;
  return Math.min(1, Math.max(0, el.scrollTop / maxScroll));
}

function progressToSceneIndex(p: number, sceneCount: number): number {
  if (sceneCount <= 0) return 0;
  return Math.min(sceneCount - 1, Math.floor(p * sceneCount));
}

const TOP_EPS = 0.5;

export type UseDocumentScrollSceneOptions = {
  /** Primary column with `overflow-y-auto`: uses this for progress when it can scroll; else the window. */
  scrollRootRef?: RefObject<HTMLElement | null>;
};

/**
 * Observes scroll on `scrollRootRef` when it overflows, else the document, and publishes progress
 * [0,1] and a discrete scene index (N equal buckets).
 */
export function useDocumentScrollScene(
  sceneCount: number,
  options: UseDocumentScrollSceneOptions = {},
) {
  const { scrollRootRef } = options;
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const pinnedSceneIndexRef = useRef<number | null>(null);

  const update = useCallback(() => {
    const root = scrollRootRef?.current ?? null;
    const useRoot = root && root.scrollHeight > root.clientHeight + 1;
    const scrollRoot = useRoot ? root : null;
    const el = scrollRoot ?? document.documentElement;
    const p = readScrollProgress(scrollRoot);
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
  }, [sceneCount, scrollRootRef]);

  useLayoutEffect(() => {
    const tick = () => update();
    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    const ro = new ResizeObserver(tick);
    if (document.body) ro.observe(document.body);

    const root = scrollRootRef?.current ?? null;
    if (root) {
      root.addEventListener("scroll", tick, { passive: true });
      ro.observe(root);
    }

    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
      ro.disconnect();
      root?.removeEventListener("scroll", tick);
    };
  }, [update, scrollRootRef]);

  const scrollToSceneIndex = useCallback(
    (k: number) => {
      if (sceneCount <= 0) return;
      const clamped = Math.max(0, Math.min(sceneCount - 1, k));
      pinnedSceneIndexRef.current = clamped;
      setActiveSceneIndex(clamped);

      const root = scrollRootRef?.current ?? null;
      const useRoot = root && root.scrollHeight > root.clientHeight + 1;
      const el = useRoot ? root : document.documentElement;
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const targetTop =
        sceneCount <= 1 ? 0 : (clamped / sceneCount) * maxScroll;

      if (useRoot && root) {
        root.scrollTo({ top: targetTop, behavior: "smooth" });
      } else {
        window.scrollTo({ top: targetTop, behavior: "smooth" });
      }
    },
    [sceneCount, scrollRootRef],
  );

  return { scrollProgress, activeSceneIndex, scrollToSceneIndex };
}
