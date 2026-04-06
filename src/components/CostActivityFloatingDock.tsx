import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { FloatingSurface } from "@/components/FloatingDock";
import {
  formatCost,
  formatEngine,
  formatRenderDuration,
  formatRenderListTimestamp,
  formatRenderStatus,
  isStructuralFrameShellRender,
  modelDisplayLabel,
  renderCostTotalAmount,
  sumRenderCosts,
} from "@/lib/renderDisplay";
import { cn } from "@/lib/utils";
import type { Frame, Render, RenderTargetType, Scene } from "@/types/project";

const RECENT_RENDER_CAP = 15;

function coerceDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(String(d));
}

/** `all` = frame + style-kit / scene-reference image work in one list (cost rows may grow to include audio, etc.). */
export type CostActivityScope = RenderTargetType | "all";

export type CostActivityFloatingDockProps = {
  /** In-memory billable generation rows (from store); kept in sync with persistence. */
  renders: readonly Render[];
  /** List frame only, asset only, or both. Default `all`. */
  renderScope?: CostActivityScope;
  scenes: readonly Scene[];
  /** Optional: override row title (e.g. kit step). Default: `Frame {index}` or kit label for assets. */
  renderRowLabel?: (render: Render) => string;
  frames?: readonly Frame[];
  collapsible?: boolean;
  title?: string;
  /** Shown when {@link renders} has no rows for the current scope. */
  emptyListMessage?: string;
  className?: string;
};

function sceneTitleForRender(scenes: readonly Scene[], render: Render): string {
  const scene = scenes.find((s) => s.id === render.sceneId);
  const t = scene?.title?.trim();
  return t ? t : "—";
}

function globalFrameOrdinal(
  scenes: readonly Scene[],
  frames: readonly Frame[],
  render: Render,
): number | null {
  const frame = frames.find((f) => f.renderId === render.id);
  if (!frame) return null;
  const orderedScenes = [...scenes].sort((a, b) => a.index - b.index);
  let n = 0;
  for (const sc of orderedScenes) {
    const sceneFrames = frames
      .filter((f) => f.sceneId === sc.id)
      .sort((a, b) => a.index - b.index);
    for (const f of sceneFrames) {
      n += 1;
      if (f.id === frame.id) return n;
    }
  }
  return null;
}

function StatusDot({ status }: { status: Render["status"] }) {
  const color =
    status === "complete"
      ? "bg-emerald-500"
      : status === "failed"
        ? "bg-red-500"
        : status === "processing"
          ? "bg-amber-500"
          : "bg-muted-foreground/70";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={formatRenderStatus(status)}
    >
      <span
        className={cn("inline-block size-2 shrink-0 rounded-full ring-1 ring-background", color)}
        aria-hidden
      />
      <span className="sr-only">{formatRenderStatus(status)}</span>
    </span>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm leading-snug">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-foreground">{children}</span>
    </div>
  );
}

export function CostActivityFloatingDock({
  renders,
  renderScope = "all",
  scenes,
  frames = [],
  renderRowLabel,
  collapsible = true,
  title = "Cost",
  emptyListMessage,
  className,
}: CostActivityFloatingDockProps) {
  const defaultEmptyMessage =
    renderScope === "asset"
      ? "No character or object costs yet."
      : renderScope === "frame"
        ? "No frame costs in this project yet."
        : "No costs in this project yet.";
  const emptyCopy = emptyListMessage ?? defaultEmptyMessage;

  const scopedRenders = useMemo(
    () =>
      renders.filter((r) => {
        if (isStructuralFrameShellRender(r)) return false;
        if (renderScope === "all") return true;
        return r.type === renderScope;
      }),
    [renders, renderScope],
  );

  const [expandedRenderId, setExpandedRenderId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  const frameRowTitle = useCallback(
    (r: Render) => {
      if (renderRowLabel) return renderRowLabel(r);
      if (r.type === "asset") return "Kit render";
      const n = globalFrameOrdinal(scenes, frames, r);
      return n != null ? `Frame ${n}` : "Frame —";
    },
    [renderRowLabel, scenes, frames],
  );

  const orderedRenders = useMemo(() => {
    const list = [...scopedRenders];
    if (renderScope === "all") {
      list.sort((a, b) => coerceDate(b.createdAt).getTime() - coerceDate(a.createdAt).getTime());
      return list;
    }
    if (frames.length > 0) {
      list.sort((a, b) => {
        const oa = globalFrameOrdinal(scenes, frames, a);
        const ob = globalFrameOrdinal(scenes, frames, b);
        if (oa != null && ob != null && oa !== ob) return oa - ob;
        if (oa != null && ob == null) return -1;
        if (oa == null && ob != null) return 1;
        return coerceDate(b.createdAt).getTime() - coerceDate(a.createdAt).getTime();
      });
    } else {
      list.sort((a, b) => coerceDate(b.createdAt).getTime() - coerceDate(a.createdAt).getTime());
    }
    return list;
  }, [scopedRenders, renderScope, scenes, frames]);

  const displayedRenders = useMemo(
    () => orderedRenders.slice(0, RECENT_RENDER_CAP),
    [orderedRenders],
  );

  const totalCostAmount = useMemo(() => sumRenderCosts(scopedRenders), [scopedRenders]);

  const collapsedTotalCost = useMemo(() => {
    if (scopedRenders.length === 0) return null;
    const firstCur = scopedRenders[0]!.cost.currency.trim() || "USD";
    return formatCost(totalCostAmount, firstCur);
  }, [scopedRenders, totalCostAmount]);

  useEffect(() => {
    if (expandedRenderId && !scopedRenders.some((r) => r.id === expandedRenderId)) {
      setExpandedRenderId(null);
    }
  }, [scopedRenders, expandedRenderId]);

  useEffect(() => {
    if (
      expandedRenderId &&
      !displayedRenders.some((r) => r.id === expandedRenderId)
    ) {
      setExpandedRenderId(null);
    }
  }, [displayedRenders, expandedRenderId]);

  useEffect(() => {
    if (!expandedRenderId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setExpandedRenderId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedRenderId]);

  function renderDetailList(r: Render) {
    const ord = r.type === "frame" ? globalFrameOrdinal(scenes, frames, r) : null;
    return (
      <div className="flex flex-col gap-2 pb-0.5 pl-0.5">
        {r.type === "frame" ? (
          <DetailRow label="Frame">{ord != null ? String(ord) : "—"}</DetailRow>
        ) : (
          <DetailRow label="Target">Character / object</DetailRow>
        )}
        <DetailRow label="Scene">{sceneTitleForRender(scenes, r)}</DetailRow>
        <DetailRow label="Model">{modelDisplayLabel(r.model)}</DetailRow>
        <DetailRow label="Engine">{formatEngine(r.engine)}</DetailRow>
        <DetailRow label="Status">
          <span className="inline-flex items-center justify-end gap-2">
            <StatusDot status={r.status} />
            <span>{formatRenderStatus(r.status)}</span>
          </span>
        </DetailRow>
        <DetailRow label="Cost">
          {formatCost(renderCostTotalAmount(r.cost), r.cost.currency)}
        </DetailRow>
        <DetailRow label="Duration">{formatRenderDuration(r)}</DetailRow>
        <DetailRow label="Date">{formatRenderListTimestamp(coerceDate(r.createdAt))}</DetailRow>
      </div>
    );
  }

  const listBody =
    scopedRenders.length === 0 ? (
      <p className="text-sm text-muted-foreground">{emptyCopy}</p>
    ) : (
      <ul className="flex list-none flex-col gap-0 p-0" role="list">
        {displayedRenders.map((r) => {
          const expanded = expandedRenderId === r.id;
          const rowTitle = frameRowTitle(r);
          return (
            <li key={r.id} className="flex flex-col" role="listitem">
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={`${rowTitle}, ${formatRenderStatus(r.status)}`}
                className={cn(
                  "flex w-full min-w-0 items-center gap-0.5 rounded-sm px-1 py-0.5 text-left text-sm leading-snug",
                  "text-foreground hover:bg-foreground/[0.06]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                )}
                onClick={() =>
                  setExpandedRenderId((id) => (id === r.id ? null : r.id))
                }
              >
                <span className="flex h-7 w-5 shrink-0 items-center justify-center text-muted-foreground">
                  {expanded ? (
                    <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden />
                  ) : (
                    <ChevronRight className="size-3.5" strokeWidth={2} aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{rowTitle}</span>
                <span className="flex max-w-[45%] shrink-0 items-center justify-end gap-2">
                  {expanded ? (
                    <span className="tabular-nums text-foreground">
                      {formatCost(renderCostTotalAmount(r.cost), r.cost.currency)}
                    </span>
                  ) : (
                    <StatusDot status={r.status} />
                  )}
                </span>
              </button>
              {expanded ? (
                <div
                  className={cn(
                    "mt-1 min-w-0 rounded-lg border border-border/40 px-2 py-2",
                    "bg-background/92 backdrop-blur-xl dark:bg-background/88",
                  )}
                >
                  {renderDetailList(r)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );

  const headerRowToggleClass = cn(
    "flex w-full cursor-pointer items-center gap-1 rounded-md px-0.5 py-0 text-left",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
  );

  if (collapsible && collapsed) {
    return (
      <FloatingSurface className={cn("px-3 py-2 text-sm", className)}>
        <button
          type="button"
          className={headerRowToggleClass}
          onClick={() => setCollapsed(false)}
          aria-label="Expand cost"
        >
          <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
            <ChevronUp className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate font-normal leading-snug text-foreground">
            {title}
          </span>
          <span className="shrink-0 text-right tabular-nums">
            {collapsedTotalCost != null ? (
              <span className="text-foreground">{collapsedTotalCost}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </span>
        </button>
      </FloatingSurface>
    );
  }

  return (
    <FloatingSurface
      className={cn(
        "flex max-h-[min(28rem,calc(100svh-5rem))] min-h-0 flex-col gap-2 px-3 pt-2 pb-3 text-sm",
        className,
      )}
    >
        {collapsible ? (
          <button
            type="button"
            className={cn(headerRowToggleClass, "shrink-0")}
            onClick={() => setCollapsed(true)}
            aria-label="Collapse cost"
          >
            <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
              <ChevronDown className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate font-normal leading-snug text-foreground">
              {title}
            </span>
            <span className="shrink-0 text-right tabular-nums">
              {collapsedTotalCost != null ? (
                <span className="text-foreground">{collapsedTotalCost}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-normal leading-snug text-foreground">
              {title}
            </p>
            <div className="shrink-0 text-right tabular-nums">
              {collapsedTotalCost != null ? (
                <span className="text-foreground">{collapsedTotalCost}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        )}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60",
          "bg-background/92 backdrop-blur-xl dark:bg-background/88",
        )}
      >
        <div className="max-h-[min(18rem,52svh)] min-h-0 overflow-y-auto overscroll-contain px-2 py-2">
          {listBody}
        </div>
      </div>
    </FloatingSurface>
  );
}
