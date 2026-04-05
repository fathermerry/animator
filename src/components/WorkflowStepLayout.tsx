import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** First column: story script, style kits, layers aside, etc. */
  primary: ReactNode;
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
 * Shared two-column shell for Prompt, Style, and Render.
 * The page uses a single document scroll. On `lg+`, the preview column must stretch to the same
 * height as the primary column (`items-stretch`), otherwise the column is only as tall as the
 * preview and scrolls away — `position: sticky` on the preview would never engage.
 */
export function WorkflowStepLayout({
  primary,
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
      <div className="flex min-h-0 min-w-0 w-full flex-col gap-6 px-4 md:px-8 lg:max-w-[min(100%,56rem)] lg:shrink-0 lg:px-0 lg:pl-6 lg:pr-10">
        {preview}
        {previewFooter}
      </div>
    </main>
  );
}
