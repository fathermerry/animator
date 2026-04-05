import { normalizeHex } from "@/lib/color";
import type { Scene } from "@/types/project";
import type { AssetBundle } from "@/types/assetsConfig";
import { cn } from "@/lib/utils";

type Props = {
  assetBundle: AssetBundle;
  scene: Scene | null;
  onDescriptionChange: (value: string) => void;
  className?: string;
};

/** 16:9 frame with background plate; editable scene description centered in frame. */
export function ScriptScenePreview({
  assetBundle,
  scene,
  onDescriptionChange,
  className,
}: Props) {
  const bgHex = normalizeHex(assetBundle.background.color);
  const bgSrc = assetBundle.background.src?.trim();
  const value = scene?.description ?? "";
  const onImage = Boolean(bgSrc);

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
      <div
        className="relative box-border aspect-video w-full min-h-0 overflow-hidden border-2 border-dotted border-muted-foreground/45 bg-transparent"
        role="region"
        aria-label="Scene description"
      >
        <div className="absolute inset-0 z-0" style={{ backgroundColor: bgHex }} aria-hidden />
        {bgSrc ? (
          <img
            src={bgSrc}
            alt=""
            className="absolute inset-0 z-[1] h-full w-full object-cover"
          />
        ) : null}
        {bgSrc ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-2/5 bg-gradient-to-t from-black/55 to-transparent"
            aria-hidden
          />
        ) : null}
        <div className="absolute inset-0 z-[2] flex items-center justify-center p-4">
          <textarea
            value={value}
            onChange={(e) => onDescriptionChange(e.target.value)}
            disabled={!scene}
            placeholder={scene ? "Scene description" : "No scene selected"}
            spellCheck
            rows={5}
            className={cn(
              "max-h-[min(12rem,42%)] min-h-0 w-full max-w-[min(100%,28rem)] resize-none bg-transparent text-center text-base leading-relaxed [field-sizing:content]",
              "border-0 shadow-none outline-none ring-0",
              "focus-visible:ring-0",
              "placeholder:text-muted-foreground/50",
              onImage && value.trim()
                ? "text-white caret-white placeholder:text-white/45 drop-shadow-sm"
                : null,
              onImage && !value.trim()
                ? "text-white/80 caret-white placeholder:text-white/40"
                : null,
              !onImage ? "text-foreground" : null,
              !scene && "cursor-not-allowed opacity-60",
            )}
            aria-label="Scene description"
          />
        </div>
      </div>
    </div>
  );
}
