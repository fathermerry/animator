import { panelHeadingClass, panelHeadingLabelClass } from "@/lib/panelHeading";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Column heading (default “Preview”). */
  title?: string;
  /** Optional line between the “Preview” label and the frame (e.g. scene · frame on Render). */
  meta?: React.ReactNode;
  /** Right side of the top row, aligned with the “Preview” label (e.g. film duration). */
  headerRight?: React.ReactNode;
  /** Extra classes on the “Preview” label (e.g. `text-center` when the frame is centered). */
  headerClassName?: string;
  /** Extra classes on the children wrapper (e.g. flex centering). */
  contentClassName?: string;
};

/**
 * Preview block inside `WorkflowStepLayout`’s right column (max width lives on the layout).
 */
export function WorkflowPreviewColumn({
  children,
  className,
  title = "Preview",
  meta,
  headerRight,
  headerClassName,
  contentClassName,
}: Props) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col justify-start gap-2 bg-background",
        className,
      )}
    >
      {headerRight != null && headerRight !== false ? (
        <div className="mt-4 flex min-w-0 items-baseline justify-between gap-3">
          <p className={cn("shrink-0", panelHeadingLabelClass, headerClassName)}>{title}</p>
          <div className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {headerRight}
          </div>
        </div>
      ) : (
        <p className={cn(panelHeadingClass, headerClassName)}>
          {title}
        </p>
      )}
      {meta}
      <div className={cn("relative w-full min-w-0", contentClassName)}>{children}</div>
    </div>
  );
}
