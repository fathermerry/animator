import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** First column: script editor, asset kits, layers aside, etc. */
  primary: ReactNode;
  /**
   * Optional middle column (e.g. Compose step scene/frame details). Shown between primary and
   * preview on `lg+` only; omitted when not passed.
   */
  middle?: ReactNode;
  /** Extra classes on the middle column wrapper (when `middle` is set). */
  middleClassName?: string;
  /** Sticky preview block (typically `WorkflowPreviewColumn`). */
  preview: ReactNode;
  /** Optional content below the preview in the right column (e.g. Background on Style). */
  previewFooter?: ReactNode;
  /** Extra classes on `<main>`. */
  className?: string;
  /** Extra classes on the primary column wrapper (padding, etc.). */
  primaryClassName?: string;
};

/**
 * Shared shell for Script, Style, and Compose (two columns by default; optional middle on Compose).
 * The page uses a single document scroll. On `lg+`, the preview column must stretch to the same
 * height as the primary column (`items-stretch`), otherwise the column is only as tall as the
 * preview and scrolls away — `position: sticky` on the preview would never engage.
 */
export function WorkflowStepLayout({
  primary,
  middle,
  middleClassName,
  preview,
  previewFooter,
  className,
  primaryClassName,
}: Props) {
  /** Same top inset on all three columns so section headings line up (Compose step). */
  const threeColumnShellTop = middle != null ? "lg:pt-1" : undefined;
  /** Layers + Scene share an edge; gutter and divider sit before Preview. */
  const threeColumnPrimaryNarrow = middle != null ? "lg:w-auto lg:max-w-none lg:flex-none lg:pr-0" : undefined;
  const threeColumnPreviewGutter = middle != null ? "lg:pl-8" : undefined;
  const threeColumnPreviewGrow =
    middle != null ? "lg:max-w-none lg:flex-1 lg:min-w-0" : "lg:shrink-0";

  return (
    <main className={cn("flex w-full flex-col gap-8 py-4 md:gap-10 md:py-6 lg:flex-row lg:items-stretch lg:gap-0", className)}>
      <div
        className={cn(
          "min-w-0 w-full flex-1 px-4 md:px-8 lg:min-h-0 lg:pl-10 lg:pr-6",
          threeColumnShellTop,
          primaryClassName,
          threeColumnPrimaryNarrow,
        )}
      >
        {primary}
      </div>
      {middle != null ? (
        <div
          className={cn(
            "hidden min-h-0 w-full min-w-0 flex-col border-border/60 px-4 md:px-8 lg:flex lg:w-[min(100%,20rem)] lg:shrink-0 lg:overflow-visible lg:border-y-0 lg:border-l-0 lg:border-r lg:border-border/60 lg:pl-0 lg:pr-4 lg:py-0",
            threeColumnShellTop,
            middleClassName,
          )}
        >
          {middle}
        </div>
      ) : null}
      <div
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-col gap-6 px-4 md:px-8 lg:max-w-[min(100%,56rem)] lg:px-0 lg:pl-6 lg:pr-10",
          threeColumnShellTop,
          threeColumnPreviewGutter,
          threeColumnPreviewGrow,
        )}
      >
        {preview}
        {previewFooter}
      </div>
    </main>
  );
}
