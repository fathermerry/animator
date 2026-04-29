import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { FloatingSurface } from "@/components/FloatingDock";
import { cn } from "@/lib/utils";
import type { ExportJob } from "@/store/projectStore";

function formatJobTime(d: Date): string {
  return d.toLocaleString(undefined, { timeStyle: "short" });
}

function statusLabel(status: ExportJob["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatusDot({ status }: { status: ExportJob["status"] }) {
  const color =
    status === "complete"
      ? "bg-emerald-500"
      : status === "failed"
        ? "bg-red-500"
        : status === "processing"
          ? "bg-amber-500"
          : "bg-muted-foreground/70";
  return <span className={cn("inline-block size-2 rounded-full", color)} aria-hidden />;
}

export function ExportActivityFloatingDock({ jobs }: { jobs: readonly ExportJob[] }) {
  const [collapsed, setCollapsed] = useState(true);
  const ordered = useMemo(
    () => [...jobs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [jobs],
  );
  const latest = ordered[0] ?? null;

  if (collapsed) {
    return (
      <FloatingSurface className="px-3 py-2 text-sm">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-1 rounded-md px-0.5 py-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => setCollapsed(false)}
          aria-label="Expand exports"
        >
          <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
            <ChevronUp className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-foreground">Exports</span>
          {latest ? (
            <span className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
              {latest.status === "processing" ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-500" aria-hidden />
              ) : (
                <StatusDot status={latest.status} />
              )}
              {statusLabel(latest.status)}
            </span>
          ) : (
            <span className="shrink-0 text-muted-foreground">—</span>
          )}
        </button>
      </FloatingSurface>
    );
  }

  return (
    <FloatingSurface className="flex max-h-[min(28rem,calc(100svh-5rem))] min-h-0 flex-col gap-2 px-3 pt-2 pb-3 text-sm">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-1 rounded-md px-0.5 py-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={() => setCollapsed(true)}
        aria-label="Collapse exports"
      >
        <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
          <ChevronDown className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-foreground">Exports</span>
      </button>
      <div className="min-h-0 overflow-y-auto rounded-xl border border-border/60 bg-background/92 px-2 py-2">
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No export jobs yet.</p>
        ) : (
          <ul className="flex list-none flex-col gap-1 p-0" role="list">
            {ordered.slice(0, 12).map((job) => (
              <li key={job.id} className="rounded-md px-1.5 py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <StatusDot status={job.status} />
                  <span className="min-w-0 flex-1 truncate text-foreground">{job.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatJobTime(job.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">
                  {job.error ??
                    (job.status === "complete" && job.downloadPath
                      ? `Saved (${
                          job.downloadPath.toLowerCase().endsWith(".mp4")
                            ? "MP4"
                            : "ZIP with video and subtitles"
                        }) — use the link to download again`
                      : job.status === "processing"
                        ? "Rendering video (this can take a while)…"
                        : statusLabel(job.status))}
                </p>
                {job.status === "complete" && job.downloadPath ? (
                  <a
                    className="ml-4 mt-0.5 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
                    href={
                      typeof window === "undefined"
                        ? job.downloadPath
                        : new URL(job.downloadPath, window.location.origin).href
                    }
                    download
                    rel="noopener noreferrer"
                  >
                    {job.downloadPath.split("/").pop() ?? "Download"}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </FloatingSurface>
  );
}
