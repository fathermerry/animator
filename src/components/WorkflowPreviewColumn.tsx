import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Optional line between the “Preview” label and the frame (e.g. scene · frame on Render). */
  meta?: React.ReactNode;
  /** Right side of the top row, aligned with the “Preview” label (e.g. film duration). */
  headerRight?: React.ReactNode;
};

/**
 * Preview block inside `WorkflowStepLayout`’s right column (max width lives on the layout).
 * Sticky below the fixed app header (`top-14`) while the document scrolls.
 */
export function WorkflowPreviewColumn({ children, className, meta, headerRight }: Props) {
  return (
    <div
      className={cn(
        "sticky top-20 z-10 flex w-full min-w-0 flex-col gap-2 bg-background",
        className,
      )}
    >
      {headerRight != null && headerRight !== false ? (
        <div className="flex min-h-[1.25rem] min-w-0 items-center justify-between gap-3">
          <p className="shrink-0 text-xs font-medium uppercase text-muted-foreground">Preview</p>
          <div className="min-w-0 shrink-0 text-base tabular-nums leading-none text-muted-foreground">
            {headerRight}
          </div>
        </div>
      ) : (
        <p className="text-xs font-medium uppercase text-muted-foreground">Preview</p>
      )}
      {meta}
      <div className="relative w-full min-w-0">{children}</div>
    </div>
  );
}
