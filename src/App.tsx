import { useEffect, useLayoutEffect } from "react";
import { useStore } from "zustand/react";

import { AppHeader } from "@/components/AppHeader";
import { useArrowNavigation } from "@/hooks/useArrowNavigation";
import { useHashPath } from "@/hooks/useHashPath";
import { navigate } from "@/router";
import { STEPS, stepBySlug } from "@/steps";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";
import { ScriptPageView } from "@/views/ScriptPageView";
import { RenderPageView } from "@/views/RenderPageView";
import { StylePageView } from "@/views/StylePageView";

function parseSlug(path: string): string | null {
  const segments = path.split("/").filter(Boolean);
  if (path === "/" || segments.length === 0) return null;
  return segments[0] ?? null;
}

export default function App() {
  const path = useHashPath();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [path]);
  useArrowNavigation(path);

  const ensureDraft = useStore(useProjectStore, (s) => s.ensureDraftProject);
  const loadDefaultProject = useStore(useProjectStore, (s) => s.loadDefaultProject);
  const project = useStore(useProjectStore, selectCurrentProject);

  const slug = parseSlug(path);
  const isHome = path === "/" || slug === null;
  const currentSlug = slug && STEPS.some((s) => s.slug === slug) ? slug : null;

  useLayoutEffect(() => {
    if (!isHome) return;
    ensureDraft();
    loadDefaultProject();
    navigate("/prompt");
  }, [isHome, ensureDraft, loadDefaultProject]);

  useEffect(() => {
    const fileTitle = project?.fileLabel?.trim() || project?.name?.trim() || "Untitled";
    const title =
      isHome || !currentSlug
        ? fileTitle
        : `${STEPS.find((s) => s.slug === currentSlug)?.label ?? "Step"} — ${fileTitle}`;
    document.title = title;
  }, [isHome, currentSlug, project?.fileLabel, project?.name]);

  if (!isHome && slug && !currentSlug) {
    return (
      <div className="min-h-svh flex flex-col">
        <AppHeader path={path} currentSlug={null} />
        <main className="mx-auto w-full max-w-xl px-6 pb-10 pt-14">
          <p className="text-muted-foreground">Page not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-svh flex flex-col">
      <AppHeader path={path} currentSlug={currentSlug} />
      {/* Fixed header: pad so flow starts below it; one document scroll — no nested overflow */}
      <div className="pt-14">
        {isHome ? null : currentSlug === "prompt" ? (
          <ScriptPageView step={stepBySlug("prompt")!} />
        ) : currentSlug === "style" ? (
          <StylePageView step={stepBySlug("style")!} />
        ) : currentSlug === "render" ? (
          <RenderPageView step={stepBySlug("render")!} />
        ) : null}
      </div>
    </div>
  );
}
