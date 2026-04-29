import { useEffect, useLayoutEffect, useState } from "react";
import { useStore } from "zustand/react";

import { AppHeader } from "@/components/AppHeader";
import { StoryNextProvider } from "@/context/StoryNextProvider";
import { useArrowNavigation } from "@/hooks/useArrowNavigation";
import { useHashPath } from "@/hooks/useHashPath";
import { canonicalWorkflowPathIfNeeded, navigate, parseRoute, pathForProjectStep } from "@/router";
import { STEPS } from "@/steps";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";
import { HomePageView } from "@/views/HomePageView";
import { CostOverviewPageView } from "@/views/CostOverviewPageView";
import { ComposePageView } from "@/views/ComposePageView";
import { StoryPageView } from "@/views/StoryPageView";
import { cn } from "@/lib/utils";
import { hydrateProjectFromStorage } from "@/bootstrapProject";

export default function App() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hydrateProjectFromStorage().finally(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hydrated) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden">
        <p className="text-base text-muted-foreground">Loading app…</p>
      </div>
    );
  }

  return <ProjectApp />;
}

function ProjectApp() {
  const path = useHashPath();
  const route = parseRoute(path);
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

  /** Compose uses fixed panes; story scrolls with the main shell like other pages. */
  const composeLocksMainScroll = currentSlug === "compose";

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
      title = "animator — Cost";
    } else if (currentSlug) {
      const stepLabel = STEPS.find((s) => s.slug === currentSlug)?.label ?? "Project";
      title = `animator — ${stepLabel} — ${fileTitle}`;
    } else {
      title = `animator — ${fileTitle}`;
    }
    document.title = title;
  }, [showNotFound, showUrlProjectLoading, isProjectsPage, isRendersPage, currentSlug, project?.fileLabel, project?.name]);

  if (showNotFound) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <AppHeader currentSlug={null} mainNav="projects" projectId={null} />
        <main className="mx-auto w-full max-w-xl px-6 pb-10 pt-14">
          <p className="text-muted-foreground">Page not found.</p>
        </main>
      </div>
    );
  }

  if (showUrlProjectLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <AppHeader currentSlug={null} mainNav="projects" projectId={null} />
        <main className="mx-auto w-full max-w-xl px-6 pb-10 pt-14">
          <p className="text-muted-foreground">Loading project…</p>
        </main>
      </div>
    );
  }

  if (isProjectsPage || isRendersPage) {
    return (
      <div className="relative h-full min-h-0 overflow-hidden">
        <AppHeader currentSlug={null} mainNav={mainNav} projectId={null} />
        <div className="absolute inset-x-0 bottom-0 top-14 box-border flex min-h-0 w-full flex-col justify-start overflow-x-hidden overflow-y-auto overscroll-contain">
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col justify-start basis-0">
            {isProjectsPage ? <HomePageView /> : <CostOverviewPageView />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <StoryNextProvider>
      <div className="relative h-full min-h-0 overflow-hidden">
        <AppHeader currentSlug={currentSlug} mainNav={null} projectId={project.id} />
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 top-14 box-border flex min-h-0 w-full flex-col justify-start overflow-x-hidden",
            composeLocksMainScroll ? "overflow-y-hidden" : "overflow-y-auto overscroll-contain",
          )}
        >
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col justify-start basis-0">
            {currentSlug === "story" ? (
              <StoryPageView />
            ) : currentSlug === "compose" ? (
              <ComposePageView />
            ) : null}
          </div>
        </div>
      </div>
    </StoryNextProvider>
  );
}
