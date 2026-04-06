import { useEffect, useState } from "react";

import { kitAssetDisplaySrc } from "@/lib/kitAssetDisplaySrc";
import { cn } from "@/lib/utils";

type GeneratingProps = {
  /** Row is generating an image (parallel batch or single). */
  isGenerating?: boolean;
  className?: string;
};

function PreviewImageCell({ raw }: { raw: string }) {
  const displaySrc = raw ? kitAssetDisplaySrc(raw) : "";
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [raw]);

  if (!displaySrc || broken) {
    return (
      <div
        className="flex aspect-square w-full items-center justify-center bg-muted/40 text-xs text-muted-foreground"
        aria-hidden
      >
        —
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-sm ring-1 ring-border/40">
      <img
        key={`cell-${raw.length}-${raw.slice(0, 24)}`}
        src={displaySrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => {
          if (raw) setBroken(true);
        }}
      />
    </div>
  );
}

/** Single primary preview image (first kit URL) for the Style middle column. */
export function StyleKitMainPreview({
  srcs,
  isGenerating,
  className,
}: { srcs: string[] } & GeneratingProps) {
  const urls = srcs.map((s) => s.trim()).filter(Boolean);
  const raw = urls[0] ?? "";
  const displaySrc = raw ? kitAssetDisplaySrc(raw) : "";
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [raw]);
  useEffect(() => {
    if (!isGenerating) setBroken(false);
  }, [isGenerating]);

  const showImg = Boolean(displaySrc) && !broken;

  return (
    <div
      className={cn(
        "relative aspect-square w-full max-w-[11rem] min-h-0 overflow-hidden rounded-md border border-dashed border-border bg-card",
        isGenerating && "kit-tile-generating-bg",
        className,
      )}
      role="region"
      aria-label="Character preview"
    >
      {showImg ? (
        <img
          key={`main-${raw.length}`}
          src={displaySrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => {
            if (raw) setBroken(true);
          }}
        />
      ) : (
        <div className="flex h-full min-h-[6rem] flex-col items-center justify-center p-3 text-center">
          <p className="archive-text text-sm text-muted-foreground">
            {isGenerating ? "Generating…" : "No image yet"}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Up to five reference images in a compact grid (Style right column).
 */
export function StyleKitReferenceImages({ srcs, isGenerating, className }: { srcs: string[] } & GeneratingProps) {
  const urls = srcs.map((s) => s.trim()).filter(Boolean);
  const n = urls.length;

  return (
    <div
      className={cn(
        "relative w-full max-w-[14rem] min-h-0 rounded-md border border-dashed border-border bg-card p-1.5",
        isGenerating && "kit-tile-generating-bg",
        className,
      )}
      role="region"
      aria-label="Character reference images"
    >
      {n === 0 ? (
        <div className="flex min-h-[6rem] flex-col items-center justify-center px-2 py-6 text-center">
          <p className="archive-text text-sm text-muted-foreground">
            {isGenerating ? "Generating…" : "No reference images yet"}
          </p>
        </div>
      ) : n === 1 ? (
        <PreviewImageCell raw={urls[0]!} />
      ) : n === 2 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {urls.map((raw, i) => (
            <PreviewImageCell key={`${i}-${raw.slice(0, 48)}`} raw={raw} />
          ))}
        </div>
      ) : n === 3 ? (
        <div className="grid grid-cols-3 gap-1.5">
          {urls.map((raw, i) => (
            <PreviewImageCell key={`${i}-${raw.slice(0, 48)}`} raw={raw} />
          ))}
        </div>
      ) : n === 4 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {urls.map((raw, i) => (
            <PreviewImageCell key={`${i}-${raw.slice(0, 48)}`} raw={raw} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            {urls.slice(0, 3).map((raw, i) => (
              <PreviewImageCell key={`t-${i}-${raw.slice(0, 48)}`} raw={raw} />
            ))}
          </div>
          <div className="mx-auto grid w-2/3 grid-cols-2 gap-1.5">
            {urls.slice(3, 5).map((raw, i) => (
              <PreviewImageCell key={`b-${i}-${raw.slice(0, 48)}`} raw={raw} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
