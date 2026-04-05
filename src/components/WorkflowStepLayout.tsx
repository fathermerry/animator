import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** First column: story script, asset kits, layers aside, etc. */
  primary: ReactNode;
  /**
   * Optional middle column (e.g. Render step scene/frame details). Shown between primary and
   * preview on `lg+` only; omitted when not passed.
   */
  middle?: ReactNode;
  /** Extra classes on the middle column wrapper (when `middle` is set). */
  middleClassName?: string;
  /** Sticky preview block (typically `WorkflowPreviewColumn`). */
  preview: ReactNode;
  /** Optional content below the preview in the right column (e.g. Background on Assets). */
  previewFooter?: ReactNode;
  /** Extra classes on `<main>`. */
  className?: string;
  /** Extra classes on the primary column wrapper (padding, etc.). */
  primaryClassName?: string;
};

/**
 * Shared shell for Story, Assets, and Render (two columns by default; optional middle on Render).
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
  return (
    <main className={cn("flex w-full flex-col gap-8 py-4 md:gap-10 md:py-6 lg:flex-row lg:items-stretch lg:gap-0", className)}>
      <div
        className={cn(
          "min-w-0 w-full flex-1 px-4 md:px-8 lg:min-h-0 lg:pl-10 lg:pr-6",
          primaryClassName,
        )}
      >
        {primary}
      </div>
      {middle != null ? (
        <div
          className={cn(
            "hidden min-h-0 w-full min-w-0 flex-col overflow-hidden border-border/60 px-4 md:px-8 lg:flex lg:w-[min(100%,20rem)] lg:shrink-0 lg:border-x lg:px-4 lg:py-0",
            middleClassName,
          )}
        >
          {middle}
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 w-full flex-col gap-6 px-4 md:px-8 lg:max-w-[min(100%,56rem)] lg:shrink-0 lg:px-0 lg:pl-6 lg:pr-10">
        {preview}
        {previewFooter}
      </div>
    </main>
  );
}
