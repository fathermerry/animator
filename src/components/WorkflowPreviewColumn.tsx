import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Optional line between the “Preview” label and the frame (e.g. scene · frame on Render). */
  meta?: React.ReactNode;
};

/**
 * Preview block inside `WorkflowStepLayout`’s right column (max width lives on the layout).
 * Sticky below the fixed app header (`top-14`) while the document scrolls.
 */
export function WorkflowPreviewColumn({ children, className, meta }: Props) {
  return (
    <div
      className={cn(
        "sticky top-20 z-10 flex w-full min-w-0 flex-col gap-2 bg-background",
        className,
      )}
    >
      <p className="text-xs font-medium uppercase text-muted-foreground">Preview</p>
      {meta}
      <div className="relative w-full min-w-0">{children}</div>
    </div>
  );
}
