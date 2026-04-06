import { Home, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { useStore } from "zustand/react";

import { MainAppNav } from "@/components/MainAppNav";
import { Button } from "@/components/ui/button";
import { WorkflowBreadcrumb } from "@/components/WorkflowBreadcrumb";
import { downloadPersistableProjectSlice } from "@/lib/projectPersistence";
import { SAMPLE_PROJECT_ID } from "@/lib/sampleProject";
import { cn } from "@/lib/utils";
import { navigate, pathForProjectStep } from "@/router";
import { STEPS } from "@/steps";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";

type Props = {
  /** Active workflow slug when in a project step */
  currentSlug: string | null;
  /** Top-level app: Projects vs Cost; `null` = in-project workflow */
  mainNav: "projects" | "renders" | null;
  /** Current project id for workflow links; omit on top-level or error states */
  projectId: string | null;
};

export function AppHeader({ currentSlug, mainNav, projectId }: Props) {
  const project = useStore(useProjectStore, selectCurrentProject);
  const createNewProject = useStore(useProjectStore, (s) => s.createNewProject);
  const resetSampleProject = useStore(useProjectStore, (s) => s.resetSampleProject);
  const [resettingSample, setResettingSample] = useState(false);
  const styleConfigs = useStore(useProjectStore, (s) => s.styleConfigs);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const renders = useStore(useProjectStore, (s) => s.renders);
  const frames = useStore(useProjectStore, (s) => s.frames);
  const fileLabel = project?.fileLabel?.trim() || project?.name?.trim() || "Untitled";
  const isSampleProject = project.id === SAMPLE_PROJECT_ID;

  const exportProject = useCallback(() => {
    downloadPersistableProjectSlice({
      project,
      styleConfigs,
      scenes,
      renders,
      frames,
    });
  }, [project, styleConfigs, scenes, renders, frames]);

  const workflowNextStep =
    projectId && currentSlug
      ? (() => {
          const i = STEPS.findIndex((s) => s.slug === currentSlug);
          if (i < 0 || i >= STEPS.length - 1) return null;
          return STEPS[i + 1]!;
        })()
      : null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 grid min-h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-background px-6 py-3">
      <div className="flex min-w-0 items-center gap-3 justify-self-start">
        {mainNav ? (
          <span className="min-w-0 truncate text-base font-medium text-foreground">animator</span>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
              aria-label="Home"
              title="Home"
              onClick={() => navigate("/projects")}
            >
              <Home className="size-4" aria-hidden />
            </Button>
            <span className="text-border select-none" aria-hidden>
              /
            </span>
            <span className="min-w-0 truncate text-base font-medium text-foreground" title={fileLabel}>
              {fileLabel}
            </span>
            {isSampleProject ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
                aria-label="Reset sample project"
                title="Reset sample project to bundled seed and clear generated renders on disk"
                disabled={resettingSample}
                onClick={() => {
                  setResettingSample(true);
                  void resetSampleProject().finally(() => setResettingSample(false));
                }}
              >
                <RefreshCw className={cn("size-4", resettingSample && "animate-spin")} aria-hidden />
              </Button>
            ) : null}
          </>
        )}
      </div>

      <div className="flex justify-center justify-self-center">
        {mainNav ? (
          <MainAppNav active={mainNav} />
        ) : projectId ? (
          <WorkflowBreadcrumb currentSlug={currentSlug} projectId={projectId} />
        ) : null}
      </div>

      <div className="flex justify-end justify-self-end">
        {mainNav === "projects" ? (
          <Button
            type="button"
            variant="secondary"
            className="cursor-pointer disabled:cursor-not-allowed"
            disabled
            title="New project is temporarily unavailable"
            onClick={() => void createNewProject()}
          >
            New project
          </Button>
        ) : mainNav === "renders" ? null : workflowNextStep && projectId ? (
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            title={`Next: ${workflowNextStep.label}`}
            onClick={() => navigate(pathForProjectStep(projectId, workflowNextStep.slug))}
          >
            Next
          </Button>
        ) : (
          <Button type="button" variant="outline" className="cursor-pointer" onClick={exportProject}>
            Export
          </Button>
        )}
      </div>
    </header>
  );
}
