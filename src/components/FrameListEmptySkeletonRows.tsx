import { cn } from "@/lib/utils";

type Variant = "compose" | "layers";

const skeletonBlock = "rounded bg-muted/80 animate-pulse";

function pulseBar(className?: string) {
  return <span className={cn(skeletonBlock, className)} aria-hidden />;
}

/** One keyframe row shell matching ComposePageView (thumb + badge + label). */
function ComposeKeyframeSkeletonItem({
  labelMaxClass,
}: {
  labelMaxClass: string;
}) {
  return (
    <li className="list-none">
      <div
        className={cn(
          "flex w-full min-w-0 cursor-default items-center gap-1 rounded-md border border-border/40 bg-card/20 px-1 py-0.5 text-left transition-colors",
          "pointer-events-none select-none",
        )}
        aria-hidden
      >
        <span className="relative h-7 w-11 shrink-0 overflow-hidden rounded bg-muted ring-1 ring-border/30 animate-pulse" />
        <span className="flex h-5 min-w-[2.25rem] shrink-0 items-center justify-center rounded bg-muted/70 px-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {pulseBar("h-2 w-6 max-w-full rounded-sm opacity-80")}
        </span>
        <span
          className={cn(
            skeletonBlock,
            "h-[11px] min-w-0 flex-1 rounded-sm self-center",
            labelMaxClass,
          )}
        />
      </div>
    </li>
  );
}

/** Placeholder keyframe rows under a scene (Compose). */
function ComposeKeyframeSkeletonRows() {
  const labels = ["max-w-[78%]", "max-w-[55%]", "max-w-[92%]"] as const;
  return (
    <>
      {[0, 1].map((k) => (
        <ComposeKeyframeSkeletonItem key={k} labelMaxClass={labels[k % labels.length]} />
      ))}
    </>
  );
}

/** Placeholder frame rows in the layers tree. */
function LayersFrameSkeletonRows() {
  return (
    <>
      {[0, 1].map((k) => (
        <li key={k} className="list-none py-0.5 pl-1">
          <div className="flex h-8 w-full min-w-0 items-center gap-2">
            {pulseBar("h-6 w-10 shrink-0 rounded-[2px]")}
            {pulseBar("h-3.5 w-14 shrink-0")}
            {pulseBar("h-3.5 min-w-0 flex-1 max-w-[55%]")}
          </div>
        </li>
      ))}
    </>
  );
}

/**
 * Empty film (no scenes): one scene-shaped block with header + three nested keyframe
 * placeholders — same structure as Compose when a shot is expanded with keyframes.
 */
export function FilmShotsEmptySkeletonList({ className }: { className?: string }) {
  const labelWidths = ["max-w-[80%]", "max-w-[58%]", "max-w-[70%]"] as const;
  return (
    <ul className={cn("list-none space-y-2 p-0", className)} role="status" aria-label="No shots yet">
      <li className="list-none">
        <div className="rounded-lg border border-transparent px-1.5 py-1.5 transition-colors">
          <div
            className="flex w-full min-w-0 cursor-default items-center gap-1.5 text-left pointer-events-none select-none"
            aria-hidden
          >
            <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground leading-none">
              {pulseBar("mx-auto h-[11px] w-2 rounded-[1.5px]")}
            </span>
            <span
              className={cn(
                skeletonBlock,
                "h-4 min-w-0 flex-1 max-w-[72%] rounded-[2px] self-center",
              )}
            />
            <span className="flex w-10 shrink-0 justify-end tabular-nums leading-none">
              {pulseBar("h-[11px] w-[1.85rem] rounded-[1.5px]")}
            </span>
          </div>
          <ul
            className="mt-1.5 ml-1.5 list-none space-y-0.5 border-l border-border/50 pl-2"
            role="presentation"
          >
            {[0, 1, 2].map((i) => (
              <ComposeKeyframeSkeletonItem key={i} labelMaxClass={labelWidths[i]} />
            ))}
          </ul>
        </div>
      </li>
    </ul>
  );
}

export function FrameListEmptySkeletonRows({ variant }: { variant: Variant }) {
  if (variant === "layers") {
    return <LayersFrameSkeletonRows />;
  }
  return <ComposeKeyframeSkeletonRows />;
}
