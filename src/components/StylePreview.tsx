import type { Style } from "@/types/styleConfig";
import { cn } from "@/lib/utils";

type Props = {
  style: Style;
  className?: string;
  /** When set, shows the kit asset id in a bordered overlay (style page selection). */
  kitSelectionDisplayId?: string | null;
};

/** Full-bleed 16:9 frame — dotted border only (no fill; shows page behind). */
export function StylePreview({
  style: _style,
  className,
  kitSelectionDisplayId = null,
}: Props) {
  return (
    <div
      className={cn(
        "relative box-border aspect-video w-full min-h-0 overflow-hidden border-2 border-dotted border-muted-foreground/45 bg-transparent",
        className,
      )}
      role="region"
      aria-label="Video preview"
    >
      {kitSelectionDisplayId ? (
        <div
          className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center p-6"
          aria-hidden
        >
          <div className="rounded-md border-2 border-white px-5 py-3 text-base text-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)] [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]">
            {kitSelectionDisplayId}
          </div>
        </div>
      ) : null}
    </div>
  );
}
