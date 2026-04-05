import type { ReactNode } from "react";

import { normalizeHex } from "@/lib/color";
import type { Style } from "@/types/styleConfig";
import { cn } from "@/lib/utils";

/** Selected kit copy shown in the style-step preview while that asset is selected. */
export type StylePreviewKitHover = {
  id: string;
  name: string;
  description?: string;
  kind: "characters" | "objects";
};

type Props = {
  style: Style;
  className?: string;
  /** When set (asset selected on the style step), id, name, and description show on the preview. */
  kitHoverDetail?: StylePreviewKitHover | null;
  /** Background color/image controls (e.g. style step only); rendered below the frame. */
  backgroundEditor?: ReactNode;
};

/** Full-bleed 16:9 frame with style background plate; optional kit detail overlay while selected. */
export function StylePreview({
  style,
  className,
  kitHoverDetail = null,
  backgroundEditor,
}: Props) {
  const bgHex = normalizeHex(style.background.color);
  const bgSrc = style.background.src?.trim();

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        backgroundEditor ? "gap-7" : "gap-3",
        className,
      )}
    >
      <div
        className="relative box-border aspect-video w-full min-h-0 overflow-hidden border-2 border-dotted border-muted-foreground/45 bg-transparent"
        role="region"
        aria-label="Preview"
      >
        <div className="absolute inset-0 z-0" style={{ backgroundColor: bgHex }} aria-hidden />
        {bgSrc ? (
          <img
            src={bgSrc}
            alt=""
            className="absolute inset-0 z-[1] h-full w-full object-cover"
          />
        ) : null}
        {kitHoverDetail ? (
          <div className="absolute inset-0 z-[2] flex items-center justify-center p-4">
            <div
              className={cn(
                "w-full max-w-[min(100%,28rem)] max-h-[min(100%,14rem)] overflow-y-auto rounded-md bg-background/90 px-4 py-3 text-left shadow-sm backdrop-blur-sm",
              )}
            >
              <p
                className={cn(
                  "text-[13px] text-muted-foreground",
                  kitHoverDetail.kind === "characters" && "uppercase",
                )}
              >
                {kitHoverDetail.id}
              </p>
              <p className="mt-1 text-base text-foreground">{kitHoverDetail.name}</p>
              {kitHoverDetail.description ? (
                <p className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {kitHoverDetail.description}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {backgroundEditor}
    </div>
  );
}
