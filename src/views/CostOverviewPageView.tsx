import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listAllRendersAcrossProjects,
  type RenderListRow,
} from "@/lib/projectIndexedDb";
import {
  formatCost,
  renderCostTotalAmount,
  formatEngine,
  formatRenderDuration,
  formatRenderListTimestamp,
  formatRenderStatus,
} from "@/lib/renderDisplay";
import { panelHeadingClass } from "@/lib/panelHeading";
import { cn } from "@/lib/utils";

export function CostOverviewPageView() {
  const [dbRows, setDbRows] = useState<RenderListRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void listAllRendersAcrossProjects()
      .then(setDbRows)
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : "Could not load cost data");
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rows = dbRows;

  return (
    <main className="w-full px-6 pb-10 pt-6">
      {loadError ? (
        <p className="mb-4 text-base text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      <p className={cn(panelHeadingClass, "mb-3")}>Cost</p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border px-4 py-10">
          <p className="text-center text-base text-muted-foreground">
            No costs yet. OpenAI image runs in your projects are listed here after you generate frames.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="relative min-w-0 flex-1 sm:max-w-xl">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="cost-search"
                  type="search"
                  placeholder="Search…"
                  className="pl-9"
                  disabled
                  title="Search is not available yet"
                  autoComplete="off"
                  aria-label="Search cost history"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 min-w-[10rem] justify-between gap-2 font-normal"
                  disabled
                  title="Filters are not available yet"
                >
                  All projects
                  <ChevronDown className="size-4 opacity-60" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 min-w-[10rem] justify-between gap-2 font-normal"
                  disabled
                  title="Filters are not available yet"
                >
                  All engines
                  <ChevronDown className="size-4 opacity-60" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 min-w-[10rem] justify-between gap-2 font-normal"
                  disabled
                  title="Filters are not available yet"
                >
                  All statuses
                  <ChevronDown className="size-4 opacity-60" aria-hidden />
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] border-collapse text-base">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-foreground">Project</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Scene</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Engine</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Model</th>
                  <th className="px-3 py-2 text-right font-medium text-foreground">Cost</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Duration</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { render, projectLabel, sceneTitle } = row;
                  return (
                    <tr key={render.id} className="border-b border-border last:border-b-0">
                      <td className="max-w-[12rem] px-3 py-2 align-top text-foreground">
                        <span className="line-clamp-2" title={projectLabel}>
                          {projectLabel}
                        </span>
                      </td>
                      <td className="max-w-[10rem] px-3 py-2 align-top text-foreground">
                        {sceneTitle ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-foreground">
                        {formatEngine(render.engine)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-foreground">
                        {formatRenderStatus(render.status)}
                      </td>
                      <td className="max-w-[8rem] px-3 py-2 align-top text-muted-foreground">
                        {render.model?.trim() ? render.model : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-right text-foreground">
                        {formatCost(renderCostTotalAmount(render.cost), render.cost.currency)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-muted-foreground">
                        {formatRenderDuration(render)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-muted-foreground">
                        {formatRenderListTimestamp(render.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
