import { ChevronRight, Home, Loader2 } from "lucide-react";
import { useStore } from "zustand/react";

import { MainAppNav } from "@/components/MainAppNav";
import { WorkflowStepNav } from "@/components/WorkflowStepNav";
import { Button } from "@/components/ui/button";
import { useStoryNextContext } from "@/context/StoryNextProvider";
import { navigate } from "@/router";
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
  const requestExportJob = useStore(useProjectStore, (s) => s.requestExportJob);
  const fileLabel = project?.fileLabel?.trim() || project?.name?.trim() || "Untitled";
  const titleValue = project.name.trim() === "Untitled" && project.fileLabel?.trim()
    ? project.fileLabel.trim()
    : project.name;
  const inWorkflow = Boolean(projectId && currentSlug);
  const workflowStep =
    currentSlug === "story" || currentSlug === "compose" ? currentSlug : null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-background px-6 py-0">
      <div className="flex min-w-0 items-center gap-2 justify-self-start sm:gap-3">
        {inWorkflow && projectId ? (
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
            <input
              value={titleValue}
              onChange={(e) =>
                useProjectStore.setState((s) => ({
                  project: { ...s.project, name: e.target.value },
                }))
              }
              className="min-w-0 max-w-full flex-1 truncate rounded-md border-0 bg-transparent py-1 pr-0 text-left text-base font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Project title"
              title={fileLabel}
            />
          </>
        ) : mainNav ? (
          <span className="min-w-0 truncate text-base font-medium text-foreground">animator</span>
        ) : null}
      </div>

      <div className="flex min-w-0 justify-center justify-self-center">
        {inWorkflow && projectId && workflowStep ? (
          <WorkflowStepNav projectId={projectId} active={workflowStep} />
        ) : mainNav ? (
          <MainAppNav active={mainNav} />
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
        ) : mainNav === "renders" ? null : inWorkflow && currentSlug === "story" ? (
          <StoryHeaderNextButton />
        ) : inWorkflow && currentSlug === "compose" ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 cursor-pointer px-3"
            onClick={() => void requestExportJob()}
          >
            Export
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function StoryHeaderNextButton() {
  const { onStoryNext, storyNextBusy } = useStoryNextContext();
  return (
    <Button
      type="button"
      onClick={() => void onStoryNext()}
      disabled={storyNextBusy}
      className="h-9 shrink-0 cursor-pointer gap-1.5 disabled:cursor-not-allowed"
    >
      {storyNextBusy ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
      Next
      <ChevronRight className="size-4 shrink-0" aria-hidden />
    </Button>
  );
}
