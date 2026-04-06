import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

function progressForElement(el: HTMLElement): number {
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
  /** Scroll container for the script column (`primaryColumnRef` only — no window or outer shell). */
  scrollRootRef?: RefObject<HTMLElement | null>;
};

/**
 * Maps vertical scroll within the primary column to scene index (N equal buckets). Scene clicks
 * scroll that same column only.
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
    const el = scrollRootRef?.current;
    if (!el) return;

    const p = progressForElement(el);
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

    window.addEventListener("resize", tick);
    const ro = new ResizeObserver(tick);
    if (document.body) ro.observe(document.body);

    const root = scrollRootRef?.current;
    if (root) {
      root.addEventListener("scroll", tick, { passive: true });
      ro.observe(root);
    }

    return () => {
      window.removeEventListener("resize", tick);
      ro.disconnect();
      root?.removeEventListener("scroll", tick);
    };
  }, [update, scrollRootRef]);

  const scrollToSceneIndex = useCallback(
    (k: number) => {
      const el = scrollRootRef?.current;
      if (!el || sceneCount <= 0) return;

      const clamped = Math.max(0, Math.min(sceneCount - 1, k));
      pinnedSceneIndexRef.current = clamped;
      setActiveSceneIndex(clamped);

      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const targetTop =
        sceneCount <= 1 ? 0 : (clamped / sceneCount) * maxScroll;

      el.scrollTo({ top: targetTop, behavior: "smooth" });
    },
    [sceneCount, scrollRootRef],
  );

  return { scrollProgress, activeSceneIndex, scrollToSceneIndex };
}
