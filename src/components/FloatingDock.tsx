import { Children, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Shared frosted panel chrome for fixed “dock” UI (scene edit, cost, etc.). */
export const floatingSurfaceClass =
  "rounded-2xl border border-border bg-background/92 shadow-sm backdrop-blur-xl dark:bg-background/88";

type FloatingSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export function FloatingSurface({ children, className }: FloatingSurfaceProps) {
  return <div className={cn(floatingSurfaceClass, "min-w-0", className)}>{children}</div>;
}

type FloatingDockStackProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Fixed bottom-right stack for one or more {@link FloatingSurface} panels. Children render bottom-up
 * (first child sits above the next), with pointer events only on panel content.
 */
export function FloatingDockStack({ children, className }: FloatingDockStackProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-6 right-6 z-30 flex max-h-[calc(100svh-2rem)] w-[min(20rem,calc(100vw-2rem))] max-w-[min(20rem,calc(100vw-2rem))] flex-col-reverse gap-3 overflow-y-auto overscroll-contain",
        className,
      )}
    >
      {Children.map(children, (child, i) => (
        <div key={i} className="pointer-events-auto min-w-0 w-full shrink-0">
          {child}
        </div>
      ))}
    </div>
  );
}
