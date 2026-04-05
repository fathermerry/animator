import { useSyncExternalStore } from "react";

import { getPath } from "@/router";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

/**
 * SSR / static fallback. On the client this must return the same value as `getPath()` for the
 * initial render, or React will treat the external store as changing every frame and loop
 * (see: "The result of getSnapshot should be cached" / maximum update depth).
 */
function getServerSnapshot(): string {
  if (typeof window === "undefined") return "/";
  return getPath();
}

/**
 * Current hash path, always aligned with `window.location.hash` (single source of truth).
 * Using `useSyncExternalStore` avoids stale React state after programmatic `navigate()` or
 * edge cases where `hashchange` ordering left the route out of sync with the URL.
 */
export function useHashPath(): string {
  return useSyncExternalStore(subscribe, getPath, getServerSnapshot);
}
