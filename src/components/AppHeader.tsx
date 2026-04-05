import { FolderOpen } from "lucide-react";
import { useCallback } from "react";
import { useStore } from "zustand/react";

import { MainAppNav } from "@/components/MainAppNav";
import { Button } from "@/components/ui/button";
import { WorkflowBreadcrumb } from "@/components/WorkflowBreadcrumb";
import { downloadPersistableProjectSlice } from "@/lib/projectPersistence";
import { navigate } from "@/router";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";

type Props = {
  /** Active workflow slug when in a project step */
  currentSlug: string | null;
  /** Top-level app: Projects vs Renders; `null` = in-project workflow */
  mainNav: "projects" | "renders" | null;
};

export function AppHeader({ currentSlug, mainNav }: Props) {
  const project = useStore(useProjectStore, selectCurrentProject);
  const createNewProject = useStore(useProjectStore, (s) => s.createNewProject);
  const assetsConfigs = useStore(useProjectStore, (s) => s.assetsConfigs);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const renders = useStore(useProjectStore, (s) => s.renders);
  const frames = useStore(useProjectStore, (s) => s.frames);
  const fileLabel = project?.fileLabel?.trim() || project?.name?.trim() || "Untitled";

  const exportProject = useCallback(() => {
    downloadPersistableProjectSlice({
      project,
      assetsConfigs,
      scenes,
      renders,
      frames,
    });
  }, [project, assetsConfigs, scenes, renders, frames]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 grid min-h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-background px-6 py-3">
      <div className="flex min-w-0 items-center gap-1 justify-self-start">
        {mainNav ? (
          <span className="min-w-0 truncate text-base font-medium text-foreground">animator</span>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/projects")}
            >
              Home
            </Button>
            <span className="text-border select-none" aria-hidden>
              /
            </span>
            <span className="min-w-0 truncate text-base font-medium text-foreground" title={fileLabel}>
              {fileLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="All projects"
              title="All projects"
              onClick={() => navigate("/projects")}
            >
              <FolderOpen className="size-4" aria-hidden />
            </Button>
          </>
        )}
      </div>

      <div className="flex justify-center justify-self-center">
        {mainNav ? <MainAppNav active={mainNav} /> : <WorkflowBreadcrumb currentSlug={currentSlug} />}
      </div>

      <div className="flex justify-end justify-self-end">
        {mainNav === "projects" ? (
          <Button type="button" onClick={() => void createNewProject()}>
            New project
          </Button>
        ) : mainNav === "renders" ? null : (
          <Button type="button" variant="outline" className="cursor-pointer" onClick={exportProject}>
            Export
          </Button>
        )}
      </div>
    </header>
  );
}
