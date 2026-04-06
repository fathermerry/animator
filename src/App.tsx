import { useEffect, useLayoutEffect, useState } from "react";
import { useStore } from "zustand/react";

import { AppHeader } from "@/components/AppHeader";
import { useArrowNavigation } from "@/hooks/useArrowNavigation";
import { useHashPath } from "@/hooks/useHashPath";
import { canonicalWorkflowPathIfNeeded, navigate, parseRoute, pathForProjectStep } from "@/router";
import { STEPS, stepBySlug } from "@/steps";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";
import { ComposePageView } from "@/views/ComposePageView";
import { StoryPageView } from "@/views/StoryPageView";
import { StylePageView } from "@/views/StylePageView";
import { HomePageView } from "@/views/HomePageView";
import { RendersOverviewPageView } from "@/views/RendersOverviewPageView";
import { cn } from "@/lib/utils";

export default function App() {
  const path = useHashPath();
  const route = parseRoute(path);
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [path]);
  const project = useStore(useProjectStore, selectCurrentProject);
  const loadProjectById = useStore(useProjectStore, (s) => s.loadProjectById);

  useArrowNavigation(path, project.id);

  const legacyStepSlug = route.kind === "legacyWorkflow" ? route.stepSlug : null;
  useLayoutEffect(() => {
    if (legacyStepSlug === null) return;
    navigate(pathForProjectStep(project.id, legacyStepSlug));
  }, [legacyStepSlug, project.id]);

  const canonicalWorkflowPath = canonicalWorkflowPathIfNeeded(path);
  useLayoutEffect(() => {
    if (canonicalWorkflowPath === null) return;
    navigate(canonicalWorkflowPath);
  }, [canonicalWorkflowPath]);

  const workflowProjectId = route.kind === "workflow" ? route.projectId : null;
  const [urlProjectError, setUrlProjectError] = useState(false);
  const needsUrlProjectSync =
    workflowProjectId !== null && workflowProjectId !== project.id;

  useEffect(() => {
    if (workflowProjectId === null) {
      setUrlProjectError(false);
      return;
    }
    if (workflowProjectId === project.id) {
      setUrlProjectError(false);
      return;
    }
    setUrlProjectError(false);
    let cancelled = false;
    void loadProjectById(workflowProjectId).then((ok) => {
      if (!cancelled && !ok) setUrlProjectError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [workflowProjectId, project.id, loadProjectById]);

  const currentSlug =
    route.kind === "workflow" || route.kind === "legacyWorkflow" ? route.stepSlug : null;

  const isWorkflowStepPage =
    currentSlug === "story" ||
    currentSlug === "style" ||
    currentSlug === "compose";

  const isProjectsPage = route.kind === "home" || route.kind === "projects";
  const isRendersPage = route.kind === "renders";
  const mainNav: "projects" | "renders" | null = isProjectsPage
    ? "projects"
    : isRendersPage
      ? "renders"
      : null;

  const showNotFound =
    route.kind === "notFound" || (route.kind === "workflow" && urlProjectError);
  const showUrlProjectLoading = route.kind === "workflow" && needsUrlProjectSync && !urlProjectError;

  useEffect(() => {
    if (showNotFound) {
      document.title = "animator — Not found";
      return;
    }
    if (showUrlProjectLoading) {
      document.title = "animator — Loading…";
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
  }, [showNotFound, showUrlProjectLoading, isProjectsPage, isRendersPage, currentSlug, project?.fileLabel, project?.name]);

  if (showNotFound) {
    return (
      <div className="min-h-svh flex flex-col">
        <AppHeader currentSlug={null} mainNav="projects" projectId={null} />
        <main className="mx-auto w-full max-w-xl px-6 pb-10 pt-14">
          <p className="text-muted-foreground">Page not found.</p>
        </main>
      </div>
    );
  }

  if (showUrlProjectLoading) {
    return (
      <div className="min-h-svh flex flex-col">
        <AppHeader currentSlug={null} mainNav="projects" projectId={null} />
        <main className="mx-auto w-full max-w-xl px-6 pb-10 pt-14">
          <p className="text-muted-foreground">Loading project…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-svh">
      <AppHeader currentSlug={currentSlug} mainNav={mainNav} projectId={mainNav ? null : project.id} />
      {/* Height = viewport minus fixed header. Inner flex-1 min-h-0 fills so workflow columns align from the top (no vertical centering). */}
      <div
        className={cn(
          "mt-14 box-border flex h-[calc(100svh-3.5rem)] min-h-0 w-full flex-col justify-start overflow-x-hidden lg:overflow-y-hidden",
          isWorkflowStepPage ? "overflow-y-hidden" : "overflow-y-auto",
        )}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col justify-start basis-0">
          {isProjectsPage ? (
            <HomePageView />
          ) : isRendersPage ? (
            <RendersOverviewPageView />
          ) : currentSlug === "story" ? (
            <StoryPageView step={stepBySlug("story")!} />
          ) : currentSlug === "style" ? (
            <StylePageView step={stepBySlug("style")!} />
          ) : currentSlug === "compose" ? (
            <ComposePageView step={stepBySlug("compose")!} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
