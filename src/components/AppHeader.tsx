import { Home } from "lucide-react";
import { useStore } from "zustand/react";

import { MainAppNav } from "@/components/MainAppNav";
import { Button } from "@/components/ui/button";
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

  return (
    <header className="fixed inset-x-0 top-0 z-50 grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-background px-6 py-0">
      <div className="flex min-w-0 items-center gap-3 justify-self-start">
        {inWorkflow ? (
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
        ) : mainNav ? (
          <span className="min-w-0 truncate text-base font-medium text-foreground">animator</span>
        ) : null}
      </div>

      <div className="flex justify-center justify-self-center">
        {inWorkflow ? (
          <input
            value={titleValue}
            onChange={(e) =>
              useProjectStore.setState((s) => ({
                project: { ...s.project, name: e.target.value },
              }))
            }
            className="w-[min(40vw,24rem)] min-w-0 rounded-md border-0 bg-transparent px-2 py-1 text-center text-base font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Project title"
            title={fileLabel}
          />
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
        ) : mainNav === "renders" ? null : inWorkflow ? (
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => void requestExportJob()}>
            Export
          </Button>
        ) : null}
      </div>
    </header>
  );
}
