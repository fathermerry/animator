import { FolderOpen } from "lucide-react";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
import { WorkflowBreadcrumb } from "@/components/WorkflowBreadcrumb";
import { WorkflowStepArrows } from "@/components/WorkflowStepArrows";
import { selectCurrentProject, useProjectStore } from "@/store/projectStore";

type Props = {
  path: string;
  /** Active workflow slug, or `null` when none selected */
  currentSlug: string | null;
};

export function AppHeader({ path, currentSlug }: Props) {
  const project = useStore(useProjectStore, selectCurrentProject);
  const fileLabel = project?.fileLabel?.trim() || project?.name?.trim() || "Untitled";

  return (
    <header className="fixed inset-x-0 top-0 z-50 grid min-h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-background px-6 py-3">
      <div className="flex min-w-0 items-center gap-1 justify-self-start">
        <span className="min-w-0 truncate text-base font-medium text-foreground" title={fileLabel}>
          {fileLabel}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Open another project file"
          title="Open another project file"
          onClick={() => {
            /* TODO: open file picker / load project */
          }}
        >
          <FolderOpen className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="flex justify-center justify-self-center">
        <WorkflowBreadcrumb currentSlug={currentSlug} />
      </div>

      <div className="flex justify-end justify-self-end">
        <WorkflowStepArrows path={path} />
      </div>
    </header>
  );
}
