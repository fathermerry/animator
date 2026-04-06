import { kitAssetDisplaySrc } from "@/lib/kitAssetDisplaySrc";
import { cn } from "@/lib/utils";
import type { Scene } from "@/types/project";

type Props = {
  scene: Scene | null;
  className?: string;
};

/**
 * Style-step preview: selected scene’s reference still only (same frame chrome as film preview, no player).
 */
export function StyleSceneReferencePreview({ scene, className }: Props) {
  const raw = scene?.referenceImageSrc?.trim() ?? "";
  const displaySrc = raw ? kitAssetDisplaySrc(raw) : "";

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
      <div
        className="relative box-border aspect-video w-full min-h-0 shrink-0 overflow-hidden rounded-md border-2 border-dotted border-muted-foreground/45 bg-black"
        role="region"
        aria-label="Scene reference preview"
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="archive-text text-center text-sm text-muted-foreground">
              {scene
                ? "No reference image — generate one in Scene references."
                : "No scenes in the script."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
