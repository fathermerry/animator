import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isLightBackground, normalizeHex } from "@/lib/color";
import type { AssetBundle } from "@/types/assetsConfig";
import { cn } from "@/lib/utils";

/** Selected kit copy shown in the Assets step preview while that row is selected. */
export type AssetsPreviewKitHover = {
  id: string;
  name: string;
  description?: string;
  kind: "characters" | "objects";
};

type Props = {
  assetBundle: AssetBundle;
  className?: string;
  /** When set (asset selected), id, name, and description show on the preview. */
  kitHoverDetail?: AssetsPreviewKitHover | null;
  /** Update name / description while editing the overlay (characters include description). */
  onPatchKitDetail?: (patch: { name?: string; description?: string }) => void;
  /** Background color/image controls; rendered below the frame. */
  backgroundEditor?: ReactNode;
};

/** Full-bleed 16:9 frame with background plate; optional kit detail overlay while selected. */
function overlayTextColors(bgHex: string): { primary: string; muted: string } {
  const light = isLightBackground(bgHex);
  return light
    ? { primary: "#000000", muted: "rgba(0,0,0,0.55)" }
    : { primary: "#ffffff", muted: "rgba(255,255,255,0.55)" };
}

export function AssetsPreview({
  assetBundle,
  className,
  kitHoverDetail = null,
  onPatchKitDetail,
  backgroundEditor,
}: Props) {
  const bgHex = normalizeHex(assetBundle.background.color);
  const bgSrc = assetBundle.background.src?.trim();
  const fg = overlayTextColors(bgHex);

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
                "w-full max-w-[min(100%,28rem)] max-h-[min(100%,14rem)] overflow-y-auto rounded-md bg-transparent px-4 py-3 text-left",
              )}
            >
              <p
                className={cn(
                  "text-[13px]",
                  kitHoverDetail.kind === "characters" && "uppercase",
                )}
                style={{ color: fg.muted }}
              >
                {kitHoverDetail.id}
              </p>
              <label htmlFor={`assets-preview-kit-name-${kitHoverDetail.id}`} className="sr-only">
                {kitHoverDetail.kind === "characters" ? "Character" : "Object"} name
              </label>
              <Input
                id={`assets-preview-kit-name-${kitHoverDetail.id}`}
                className={cn(
                  "archive-text mt-1 h-auto min-h-0 border-0 bg-transparent px-0 py-0 text-base leading-snug shadow-none",
                  "dark:bg-transparent",
                  "placeholder:text-current placeholder:opacity-45",
                  "focus-visible:border-transparent focus-visible:ring-0",
                )}
                style={{ color: fg.primary }}
                placeholder="Name"
                value={kitHoverDetail.name}
                onChange={(e) => onPatchKitDetail?.({ name: e.target.value })}
                aria-label={`${kitHoverDetail.id} name`}
              />
              {kitHoverDetail.kind === "characters" ? (
                <>
                  <label
                    htmlFor={`assets-preview-kit-desc-${kitHoverDetail.id}`}
                    className="sr-only"
                  >
                    Character description
                  </label>
                  <Textarea
                    id={`assets-preview-kit-desc-${kitHoverDetail.id}`}
                    className={cn(
                      "archive-text mt-2 min-h-12 resize-none border-0 bg-transparent px-0 py-0 text-sm leading-snug shadow-none [overflow-wrap:anywhere]",
                      "dark:bg-transparent",
                      "placeholder:text-current placeholder:opacity-45",
                      "focus-visible:border-transparent focus-visible:ring-0",
                    )}
                    style={{ color: fg.muted }}
                    placeholder="Description"
                    value={kitHoverDetail.description ?? ""}
                    onChange={(e) => onPatchKitDetail?.({ description: e.target.value })}
                    rows={4}
                    aria-label={`${kitHoverDetail.id} description`}
                  />
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {backgroundEditor}
    </div>
  );
}
