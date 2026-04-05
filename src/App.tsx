import { useEffect, useLayoutEffect, useState } from "react";
import { useStore } from "zustand/react";

import { AppHeader } from "@/components/AppHeader";
import { useArrowNavigation } from "@/hooks/useArrowNavigation";
import { useHashPath } from "@/hooks/useHashPath";
import { canonicalWorkflowPathIfNeeded, navigate, parseRoute, pathForProjectStep } from "@/router";
import { STEPS, stepBySlug } from "@/steps";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";
import { RenderPageView } from "@/views/RenderPageView";
import { ScriptPageView } from "@/views/ScriptPageView";
import { StylePageView } from "@/views/StylePageView";
import { HomePageView } from "@/views/HomePageView";
import { RendersOverviewPageView } from "@/views/RendersOverviewPageView";

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
    <div className="min-h-svh flex flex-col">
      <AppHeader currentSlug={currentSlug} mainNav={mainNav} projectId={mainNav ? null : project.id} />
      {/* Fixed header: pad so flow starts below it; one document scroll — no nested overflow */}
      <div className="pt-14">
        {isProjectsPage ? (
          <HomePageView />
        ) : isRendersPage ? (
          <RendersOverviewPageView />
        ) : currentSlug === "script" ? (
          <ScriptPageView step={stepBySlug("script")!} />
        ) : currentSlug === "style" ? (
          <StylePageView step={stepBySlug("style")!} />
        ) : currentSlug === "render" ? (
          <RenderPageView step={stepBySlug("render")!} />
        ) : null}
      </div>
    </div>
  );
}
