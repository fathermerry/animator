import { useEffect } from "react";

import { navigate } from "@/router";
import { FLOW_MAX, getFlowIndex, pathForFlowIndex } from "@/steps";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useArrowNavigation(path: string): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isEditableTarget(e.target)) return;

      let idx = getFlowIndex(path);
      if (idx < 0) idx = 0;

      if (e.key === "ArrowRight") {
        if (idx >= FLOW_MAX) return;
        e.preventDefault();
        navigate(pathForFlowIndex(idx + 1));
      } else {
        if (idx <= 1) return;
        e.preventDefault();
        navigate(pathForFlowIndex(idx - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path]);
}
