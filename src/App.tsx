import { useEffect, useLayoutEffect } from "react";
import { useStore } from "zustand/react";

import { AppHeader } from "@/components/AppHeader";
import { useArrowNavigation } from "@/hooks/useArrowNavigation";
import { useHashPath } from "@/hooks/useHashPath";
import { navigate } from "@/router";
import { STEPS, stepBySlug } from "@/steps";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";
import { RenderPageView } from "@/views/RenderPageView";
import { ScriptPageView } from "@/views/ScriptPageView";
import { AssetsPageView } from "@/views/AssetsPageView";
import { HomePageView } from "@/views/HomePageView";
import { RendersOverviewPageView } from "@/views/RendersOverviewPageView";

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

  const project = useStore(useProjectStore, selectCurrentProject);

  const slug = parseSlug(path);
  const isProjectsPage = path === "/" || path === "/projects";
  const isRendersPage = path === "/renders";
  const currentSlug = slug && STEPS.some((s) => s.slug === slug) ? slug : null;
  const mainNav: "projects" | "renders" | null = isProjectsPage
    ? "projects"
    : isRendersPage
      ? "renders"
      : null;

  useLayoutEffect(() => {
    if (slug === "style") {
      navigate("/assets");
    }
  }, [slug]);

  useEffect(() => {
    if (!isProjectsPage && !isRendersPage && slug && !currentSlug) {
      document.title = "animator — Not found";
      return;
    }
    const fileTitle = project?.fileLabel?.trim() || project?.name?.trim() || "Untitled";
    let title: string;
    if (isProjectsPage) {
      title = "animator — Projects";
    } else if (isRendersPage) {
      title = "animator — Renders";
    } else if (currentSlug) {
      const stepLabel = STEPS.find((s) => s.slug === currentSlug)?.label ?? "Step";
      title = `animator — ${stepLabel} — ${fileTitle}`;
    } else {
      title = `animator — ${fileTitle}`;
    }
    document.title = title;
  }, [isProjectsPage, isRendersPage, slug, currentSlug, project?.fileLabel, project?.name]);

  if (!isProjectsPage && !isRendersPage && slug && !currentSlug) {
    return (
      <div className="min-h-svh flex flex-col">
        <AppHeader currentSlug={null} mainNav={null} />
        <main className="mx-auto w-full max-w-xl px-6 pb-10 pt-14">
          <p className="text-muted-foreground">Page not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-svh flex flex-col">
      <AppHeader currentSlug={currentSlug} mainNav={mainNav} />
      {/* Fixed header: pad so flow starts below it; one document scroll — no nested overflow */}
      <div className="pt-14">
        {isProjectsPage ? (
          <HomePageView />
        ) : isRendersPage ? (
          <RendersOverviewPageView />
        ) : currentSlug === "script" ? (
          <ScriptPageView step={stepBySlug("script")!} />
        ) : currentSlug === "assets" ? (
          <AssetsPageView step={stepBySlug("assets")!} />
        ) : currentSlug === "render" ? (
          <RenderPageView step={stepBySlug("render")!} />
        ) : null}
      </div>
    </div>
  );
}
