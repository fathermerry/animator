import type { ReactNode, Ref } from "react";

import { cn } from "@/lib/utils";

export type WorkflowStepLayoutProps = {
  /** Ordered column content: length 2 (two panels) or 3 (three panels). Index 0 = left, 1 = middle (three only), last = right. */
  panels: [ReactNode, ReactNode] | [ReactNode, ReactNode, ReactNode];
  /** Ref on the first panel’s scroll shell. */
  firstPanelRef?: Ref<HTMLDivElement>;
  /** Extra classes on the first panel wrapper. */
  primaryClassName?: string;
  /** Extra classes on the middle panel wrapper (three panels only). */
  middleClassName?: string;
  /** Extra classes on `<main>`. */
  className?: string;
  /**
   * When three panels: primary / middle / last each take one third on `lg+` (`flex-1 basis-0`).
   * Compose uses narrow first rail unless combined with other options.
   */
  equalWidthColumns?: boolean;
  /**
   * When three panels: middle column wider than first and last (Style step frame preview).
   * Mutually exclusive with `equalWidthColumns` in practice.
   */
  middleColumnWide?: boolean;
};

/**
 * Workflow shell: **panels** and **count** only (2 or 3). Steps supply content per panel; no fixed
 * “preview” semantics. Primary and trailing columns scroll independently on `lg+`; outer `<main>` is
 * `overflow-hidden`. On narrow viewports panels stack.
 */
export function WorkflowStepLayout({
  panels,
  firstPanelRef,
  primaryClassName,
  middleClassName,
  className,
  equalWidthColumns = false,
  middleColumnWide = false,
}: WorkflowStepLayoutProps) {
  const threeColumn = panels.length === 3;
  const primary = panels[0];
  const middle = threeColumn ? panels[1] : null;
  const lastPanel = threeColumn ? panels[2]! : panels[1]!;

  /** Bottom inset on `lg+`. */
  const columnContentPad = "lg:pb-4";
  const threeColWide = Boolean(threeColumn && middleColumnWide);
  const threeColEqual = Boolean(threeColumn && equalWidthColumns && !threeColWide);
  const threeColumnPrimaryNarrow = threeColumn
    ? threeColWide
      ? "lg:flex-[0.92] lg:basis-0 lg:min-w-0 lg:max-w-[min(100%,22rem)] lg:shrink-0 lg:pr-0"
      : threeColEqual
        ? "lg:flex-1 lg:basis-0 lg:min-w-0 lg:max-w-none lg:pr-0"
        : "lg:w-auto lg:max-w-none lg:flex-none lg:pr-0"
    : undefined;
  const threeColumnLastGutter = threeColumn && !threeColEqual && !threeColWide ? "lg:pl-8" : undefined;
  const threeColumnLastGrow = threeColumn
    ? threeColWide
      ? "lg:flex-[0.92] lg:basis-0 lg:min-w-0 lg:max-w-none"
      : threeColEqual
        ? "lg:flex-1 lg:basis-0 lg:min-w-0 lg:max-w-none"
        : "lg:max-w-none lg:flex-1 lg:min-w-0"
    : "lg:shrink-0";

  return (
    <main
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-1 flex-col justify-start gap-8 py-4 md:gap-10 md:py-6 lg:h-full lg:min-h-0 lg:flex-row lg:items-stretch lg:justify-start lg:gap-0 lg:overflow-hidden lg:py-0",
        threeColumn && "lg:min-h-0",
        className,
      )}
    >
      <div
        ref={firstPanelRef}
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-1 flex-col justify-start overflow-y-auto overscroll-contain px-4 md:px-8 lg:h-full lg:min-h-0 lg:pl-10 lg:pr-6",
          columnContentPad,
          threeColumnPrimaryNarrow,
          (threeColEqual || threeColWide) && "lg:px-4",
          primaryClassName,
        )}
      >
        {primary}
      </div>
      {middle != null ? (
        <div
          className={cn(
            "hidden min-h-0 w-full min-w-0 flex-col justify-start border-border/60 lg:flex lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-y-0 lg:border-x lg:border-border/60 lg:px-4",
            "lg:self-stretch",
            threeColWide
              ? "lg:flex-[1.85] lg:basis-0 lg:min-w-0 lg:max-w-none"
              : threeColEqual
                ? "lg:flex-1 lg:basis-0 lg:min-w-0 lg:max-w-none"
                : "lg:w-[min(100%,20rem)] lg:shrink-0",
            columnContentPad,
            middleClassName,
          )}
        >
          {middle}
        </div>
      ) : null}
      <div
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-1 basis-0 flex-col justify-start gap-6 overflow-y-auto overscroll-contain px-4 md:px-8 lg:h-full lg:min-w-0 lg:flex-1",
          !threeColumn && "lg:border-l lg:border-border/60",
          threeColEqual || threeColWide
            ? "lg:max-w-none lg:px-4"
            : "lg:max-w-none lg:px-0 lg:pl-6 lg:pr-10",
          columnContentPad,
          threeColumnLastGutter,
          threeColumnLastGrow,
        )}
      >
        {lastPanel}
      </div>
    </main>
  );
}
