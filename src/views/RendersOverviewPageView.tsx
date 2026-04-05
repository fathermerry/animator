import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listAllRendersAcrossProjects,
  type RenderListRow,
} from "@/lib/projectIndexedDb";
import type { Render } from "@/types/project";

/** Flip to `false` after design sign-off to show only IndexedDB rows (empty when none). */
const USE_RENDER_TABLE_DESIGN_SAMPLES = true;

function formatCost(amount: number, currency: string): string {
  const cur = currency.trim() || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${cur}`;
  }
}

function formatEngine(engine: Render["engine"]): string {
  if (engine === "openai-image") return "OpenAI image";
  if (engine === "three") return "Three";
  return "Remotion";
}

function formatStatus(status: Render["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Temporary rows to validate table layout; remove `USE_RENDER_TABLE_DESIGN_SAMPLES` when done. */
const DESIGN_SAMPLE_ROWS: RenderListRow[] = [
  {
    projectId: "00000000-0000-0000-0000-000000000001",
    projectLabel: "North quarter review",
    sceneTitle: "Boardroom",
    render: {
      id: "sample-render-1",
      projectId: "00000000-0000-0000-0000-000000000001",
      sceneId: "sample-scene-a",
      engine: "openai-image",
      status: "complete",
      model: "gpt-image-1",
      cost: {
        amount: 0.47,
        currency: "USD",
        breakdown: [{ label: "Image API", amount: 0.47 }],
      },
      createdAt: new Date("2026-04-04T09:12:00"),
    },
  },
  {
    projectId: "00000000-0000-0000-0000-000000000002",
    projectLabel: "Product launch film",
    sceneTitle: "Hero wide",
    render: {
      id: "sample-render-2",
      projectId: "00000000-0000-0000-0000-000000000002",
      sceneId: "sample-scene-b",
      engine: "remotion",
      status: "complete",
      cost: {
        amount: 0,
        currency: "USD",
        breakdown: [{ label: "Local", amount: 0 }],
      },
      createdAt: new Date("2026-04-03T16:40:00"),
    },
  },
  {
    projectId: "00000000-0000-0000-0000-000000000003",
    projectLabel: "Internal test",
    sceneTitle: "Overlay pass",
    render: {
      id: "sample-render-3",
      projectId: "00000000-0000-0000-0000-000000000003",
      sceneId: "sample-scene-c",
      engine: "openai-image",
      status: "failed",
      model: "gpt-image-1",
      cost: {
        amount: 0.12,
        currency: "USD",
        breakdown: [{ label: "Image API (failed run)", amount: 0.12 }],
      },
      createdAt: new Date("2026-04-02T11:05:00"),
    },
  },
];

export function RendersOverviewPageView() {
  const [dbRows, setDbRows] = useState<RenderListRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void listAllRendersAcrossProjects()
      .then(setDbRows)
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : "Could not load renders");
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rows = useMemo(
    () => (USE_RENDER_TABLE_DESIGN_SAMPLES ? DESIGN_SAMPLE_ROWS : dbRows),
    [dbRows],
  );

  return (
    <main className="flex min-h-[calc(100svh-3.5rem)] w-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col px-6 pb-10 pt-6">
        {loadError ? (
          <p className="mb-4 text-base text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}

        {!USE_RENDER_TABLE_DESIGN_SAMPLES && rows.length === 0 ? (
          <p className="text-base text-muted-foreground">No renders yet.</p>
        ) : (
          <>
            <div className="mb-3 shrink-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="relative min-w-0 flex-1 sm:max-w-xl">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="renders-search"
                    type="search"
                    placeholder="Search renders…"
                    className="pl-9"
                    disabled
                    title="Search is not available yet"
                    autoComplete="off"
                    aria-label="Search renders"
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

            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] border-collapse text-base">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-foreground">Project</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Scene</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Engine</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Model</th>
                  <th className="px-3 py-2 text-right font-medium text-foreground">Cost</th>
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
                        {formatStatus(render.status)}
                      </td>
                      <td className="max-w-[8rem] px-3 py-2 align-top text-muted-foreground">
                        {render.model?.trim() ? render.model : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-right text-foreground">
                        {formatCost(render.cost.amount, render.cost.currency)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-muted-foreground">
                        {render.createdAt.toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </main>
  );
}
