import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
import { listProjectSummaries, type ProjectSummary } from "@/lib/projectIndexedDb";
import { useProjectStore } from "@/store/projectStore";

export function HomePageView() {
  const [rows, setRows] = useState<ProjectSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const openProject = useStore(useProjectStore, (s) => s.openProject);
  const deleteProject = useStore(useProjectStore, (s) => s.deleteProject);

  const refresh = useCallback(() => {
    void listProjectSummaries()
      .then(setRows)
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : "Could not load projects");
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const title = (r: ProjectSummary) =>
    r.fileLabel?.trim() || r.name?.trim() || "Untitled";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-10 pt-10">
      {loadError ? (
        <p className="text-base text-muted-foreground" role="alert">
          {loadError}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-base text-muted-foreground">No projects yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="flex flex-wrap items-stretch gap-4 sm:flex-nowrap sm:items-center">
                <button
                  type="button"
                  className="relative box-border aspect-video w-full min-h-0 shrink-0 cursor-pointer overflow-hidden border-2 border-dotted border-muted-foreground/45 bg-transparent text-left sm:w-44 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => void openProject(r.id).then(refresh)}
                  aria-label={`Open ${title(r)}`}
                >
                  {r.isSample ? (
                    <span className="absolute right-1.5 top-1.5 rounded border border-border bg-background/90 px-1.5 py-px text-xs font-medium uppercase text-muted-foreground">
                      Sample
                    </span>
                  ) : null}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-medium text-foreground" title={title(r)}>
                      {title(r)}
                    </span>
                  </div>
                  <p className="text-base text-muted-foreground">
                    Updated{" "}
                    {new Date(r.updatedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => void openProject(r.id).then(refresh)}
                  >
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer disabled:cursor-not-allowed"
                    disabled={r.isSample}
                    title={r.isSample ? "The sample project cannot be deleted" : "Delete project"}
                    onClick={() => void deleteProject(r.id).then(refresh)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
