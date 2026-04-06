import type { ReactNode, Ref } from "react";

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
  /** Right column (typically `WorkflowPreviewColumn` + related UI). */
  preview: ReactNode;
  /** Optional content below the preview in the right column (e.g. Background on Style). */
  previewFooter?: ReactNode;
  /** Extra classes on `<main>`. */
  className?: string;
  /** Extra classes on the primary column wrapper (padding, etc.). */
  primaryClassName?: string;
  /** Ref on the scrollable primary column shell (e.g. Script step ties `useDocumentScrollScene` here). */
  primaryColumnRef?: Ref<HTMLDivElement>;
  /**
   * When set with `middle`, primary / middle / preview each take one third of the row on `lg+`
   * (`flex-1 basis-0`). Compose keeps the default narrow primary + fixed middle rail unless this is set.
   */
  equalWidthColumns?: boolean;
  /**
   * When set with `middle`, middle column is wider than left and right (Style step frame preview).
   * Mutually exclusive with `equalWidthColumns` in practice.
   */
  middleColumnWide?: boolean;
};

/**
 * Shared shell for Script, Style, and Compose (two columns by default; optional middle on Compose).
 * On `lg+`, each column scrolls independently (`overflow-y-auto` on column shells); the outer `<main>`
 * is `overflow-hidden` so height is bounded. The preview column stretches with the primary column
 * (`items-stretch`).
 */
export function WorkflowStepLayout({
  primary,
  middle,
  middleClassName,
  preview,
  previewFooter,
  className,
  primaryClassName,
  primaryColumnRef,
  equalWidthColumns = false,
  middleColumnWide = false,
}: Props) {
  const threeColumn = middle != null;
  /** Bottom inset on `lg+` (top alignment comes from flex justify-start + filled shell, not extra pt). */
  const columnContentPad = "lg:pb-4";
  const threeColWide = Boolean(middle != null && middleColumnWide);
  const threeColEqual = Boolean(middle != null && equalWidthColumns && !threeColWide);
  /** Layers + Scene share an edge; gutter and divider sit before Preview. */
  const threeColumnPrimaryNarrow = middle != null
    ? threeColWide
      ? "lg:flex-[0.92] lg:basis-0 lg:min-w-0 lg:max-w-[min(100%,22rem)] lg:shrink-0 lg:pr-0"
      : threeColEqual
        ? "lg:flex-1 lg:basis-0 lg:min-w-0 lg:max-w-none lg:pr-0"
        : "lg:w-auto lg:max-w-none lg:flex-none lg:pr-0"
    : undefined;
  /** Extra inset before preview when columns are not equal (Compose). Equal Style columns use symmetric `lg:px-4` only. */
  const threeColumnPreviewGutter = middle != null && !threeColEqual && !threeColWide ? "lg:pl-8" : undefined;
  const threeColumnPreviewGrow = middle != null
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
        ref={primaryColumnRef}
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-col justify-start px-4 md:px-8 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pl-10 lg:pr-6",
          columnContentPad,
          threeColumnPrimaryNarrow,
          (threeColEqual || threeColWide) && "lg:px-4",
          /** After narrow shell so steps can override (e.g. Style left rail `max-w`). */
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
          "flex min-h-0 min-w-0 w-full flex-col justify-start gap-6 overflow-y-auto overscroll-contain px-4 md:px-8 lg:h-full lg:flex-1",
          !threeColumn && "lg:border-l lg:border-border/60",
          threeColEqual || threeColWide
            ? "lg:max-w-none lg:px-4"
            : "lg:max-w-none lg:px-0 lg:pl-6 lg:pr-10",
          columnContentPad,
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
