import type { ReactNode } from "react";

import { kitSelectionOverlayClasses, normalizeHex } from "@/lib/color";
import type { Style } from "@/types/styleConfig";
import { cn } from "@/lib/utils";

type Props = {
  style: Style;
  className?: string;
  /** When set, shows the kit asset id in a bordered overlay (style page selection). */
  kitSelectionDisplayId?: string | null;
  /** Background color/image controls (e.g. style step only); rendered below the frame. */
  backgroundEditor?: ReactNode;
};

/** Full-bleed 16:9 frame with style background plate; optional kit id overlay. */
export function StylePreview({
  style,
  className,
  kitSelectionDisplayId = null,
  backgroundEditor,
}: Props) {
  const bgHex = normalizeHex(style.background.color);
  const bgSrc = style.background.src?.trim();

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
      <div
        className="relative box-border aspect-video w-full min-h-0 overflow-hidden border-2 border-dotted border-muted-foreground/45 bg-transparent"
        role="region"
        aria-label="Video preview"
      >
        <div className="absolute inset-0 z-0" style={{ backgroundColor: bgHex }} aria-hidden />
        {bgSrc ? (
          <img
            src={bgSrc}
            alt=""
            className="absolute inset-0 z-[1] h-full w-full object-cover"
          />
        ) : null}
        {kitSelectionDisplayId ? (
          <div
            className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center p-6"
            aria-hidden
          >
            <div
              className={cn(
                "rounded-md px-5 py-3 text-base",
                kitSelectionOverlayClasses(bgHex),
              )}
            >
              {kitSelectionDisplayId}
            </div>
          </div>
        ) : null}
      </div>
      {backgroundEditor}
    </div>
  );
}
