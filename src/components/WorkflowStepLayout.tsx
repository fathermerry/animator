import {
  useCallback,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";

import { cn } from "@/lib/utils";

export type ResizableAfterMiddleConfig = {
  storageKey: string;
  defaultWidthPx?: number;
  minWidthPx?: number;
  maxWidthPx?: number;
};

const MIDDLE_PANE_DEFAULT_PX = 320;

type ResizableEndProps = {
  middle: ReactNode;
  last: ReactNode;
  resizable: ResizableAfterMiddleConfig;
  /** Middle panel class names (from layout + `middleClassName` prop). */
  middleClassName: string;
  lastClassName: string;
};

/** `lg+`: left border on middle, draggable grip, flex-fill preview. */
function ResizableAfterMiddleGroup({ middle, last, resizable, middleClassName, lastClassName }: ResizableEndProps) {
  const { storageKey, defaultWidthPx = MIDDLE_PANE_DEFAULT_PX, minWidthPx = 200, maxWidthPx = 600 } = resizable;
  const baseId = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startW: number;
  } | null>(null);

  const [widthPx, setWidthPx] = useState(() => {
    if (typeof window === "undefined") return defaultWidthPx;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaultWidthPx;
      const w = Math.round(Number(raw));
      if (!Number.isFinite(w)) return defaultWidthPx;
      return Math.min(maxWidthPx, Math.max(minWidthPx, w));
    } catch {
      return defaultWidthPx;
    }
  });

  const persist = useCallback(
    (w: number) => {
      try {
        localStorage.setItem(storageKey, String(w));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const clamp = useCallback(
    (w: number) => {
      const el = groupRef.current;
      const fromView = el && el.clientWidth > 0 ? el.clientWidth - 180 : null;
      const cap = fromView != null ? Math.min(maxWidthPx, fromView) : maxWidthPx;
      const min = minWidthPx;
      const high = cap < min ? min : cap;
      return Math.min(high, Math.max(min, Math.round(w)));
    },
    [minWidthPx, maxWidthPx],
  );

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startW: widthPx };
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setWidthPx(clamp(d.startW + (e.clientX - d.startX)));
  };

  const endPointer = (e: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      dragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
      setWidthPx((w) => {
        const fin = clamp(w);
        persist(fin);
        return fin;
      });
    }
  };

  return (
    <div
      ref={groupRef}
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col lg:min-h-0 lg:min-w-0 lg:max-w-none lg:flex-1 lg:flex-row lg:items-stretch"
    >
      <div
        className={middleClassName}
        style={{ width: `min(100%, ${widthPx}px)` }}
      >
        {middle}
      </div>
      <button
        type="button"
        id={`${baseId}-split`}
        className="group relative z-10 hidden h-full min-h-0 w-0 cursor-col-resize shrink-0 touch-none self-stretch p-0 selection:bg-transparent lg:sticky lg:top-0 lg:mx-0 lg:flex lg:min-h-0 lg:w-2.5 lg:max-w-2.5"
        tabIndex={0}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize frame details and preview column widths"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <span
          className="h-full w-px shrink-0 bg-border/60 group-hover:bg-border"
          aria-hidden
        />
      </button>
      <div className={lastClassName}>
        {last}
      </div>
    </div>
  );
}

export type WorkflowStepLayoutProps = {
  /** Column content: one (full width), two, or three. Index 0 = left; 1 = middle (three only); last = right. */
  panels: [ReactNode] | [ReactNode, ReactNode] | [ReactNode, ReactNode, ReactNode];
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
  /**
   * Compose step: on `lg+`, drag the vertical line between the middle and right column to
   * redistribute width. Ignored for equal- or wide-middle layouts.
   */
  resizableAfterMiddle?: ResizableAfterMiddleConfig;
};

/**
 * Workflow shell: one, two, or **panels**. Steps supply content; primary and trailing columns scroll
 * independently on `lg+` when there are multiple; outer `<main>` is `overflow-hidden`. On narrow
 * viewports, multi-column layouts stack.
 */
export function WorkflowStepLayout({
  panels,
  firstPanelRef,
  primaryClassName,
  middleClassName,
  className,
  equalWidthColumns = false,
  middleColumnWide = false,
  resizableAfterMiddle,
}: WorkflowStepLayoutProps) {
  if (panels.length === 1) {
    return (
      <main
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-1 flex-col justify-start overflow-hidden py-4 md:py-6 lg:h-full lg:min-h-0 lg:py-0",
          className,
        )}
      >
        <div
          ref={firstPanelRef}
          className={cn(
            "flex min-h-0 min-w-0 w-full flex-1 flex-col justify-start overflow-y-auto overscroll-contain px-4 md:px-8 lg:h-full lg:min-h-0 lg:pl-10 lg:pr-6",
            primaryClassName,
          )}
        >
          {panels[0]}
        </div>
      </main>
    );
  }

  const threeColumn = panels.length === 3;
  const primary = panels[0];
  const middle = threeColumn ? panels[1] : null;
  const lastPanel = threeColumn ? panels[2]! : panels[1]!;

  const columnContentPad = "";
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

  const useResizableEnd =
    Boolean(
      resizableAfterMiddle && threeColumn && !threeColEqual && !threeColWide,
    ) && resizableAfterMiddle;

  const middleClassNames = cn(
    "hidden min-h-0 w-full min-w-0 flex-col justify-start border-border/60",
    "lg:flex lg:h-full lg:shrink-0 lg:min-h-0 lg:min-w-0 lg:overflow-y-auto lg:overscroll-contain",
    "lg:rounded-none lg:border lg:border-l lg:border-y-0 lg:border-r-0 lg:border-border/60",
    "lg:px-4",
    "lg:self-stretch",
    threeColWide
      ? "lg:flex-[1.85] lg:basis-0 lg:min-w-0 lg:max-w-none"
      : threeColEqual
        ? "lg:flex-1 lg:basis-0 lg:min-w-0 lg:max-w-none"
        : "lg:max-w-none",
    !useResizableEnd && !threeColEqual && !threeColWide
      ? "lg:w-[min(100%,20rem)]"
      : undefined,
    columnContentPad,
    middleClassName,
  );

  const lastColumnClassNames = cn(
    "flex min-h-0 min-w-0 w-full flex-1 basis-0 flex-col justify-start gap-6 overflow-y-auto overscroll-contain px-4 md:px-8 lg:h-full lg:min-w-0 lg:flex-1",
    !threeColumn && "lg:border-l lg:border-border/60",
    threeColEqual || threeColWide
      ? "lg:max-w-none lg:px-4"
      : "lg:max-w-none lg:px-0 lg:pl-6 lg:pr-10",
    columnContentPad,
    threeColumnLastGutter,
    threeColumnLastGrow,
  );

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
      {useResizableEnd && resizableAfterMiddle && middle != null ? (
        <ResizableAfterMiddleGroup
          middle={middle}
          last={lastPanel}
          resizable={resizableAfterMiddle}
          middleClassName={middleClassNames}
          lastClassName={lastColumnClassNames}
        />
      ) : (
        <>
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
          <div className={lastColumnClassNames}>
            {lastPanel}
          </div>
        </>
      )}
    </main>
  );
}
