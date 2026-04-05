import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { StylePreview, type StylePreviewKitHover } from "@/components/StylePreview";
import { WorkflowPreviewColumn } from "@/components/WorkflowPreviewColumn";
import { WorkflowStepLayout } from "@/components/WorkflowStepLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLACEHOLDER_PNG } from "@/lib/placeholderImage";
import {
  renumberCharacterKitIds,
  renumberObjectKitIds,
} from "@/lib/kitAssetId";
import { normalizeHex } from "@/lib/color";
import { validateBackgroundImageFile, validateTransparentStylePng } from "@/lib/styleAssetPng";
import { cn } from "@/lib/utils";
import { selectResolvedStyle, useProjectStore } from "@/store/projectStore";
import type { Step } from "@/steps";
import { createDefaultStyle, type Style, type StyleAsset } from "@/types/styleConfig";
import { ImagePlus, Trash2 } from "lucide-react";

type Props = { step: Step };

type KitKey = "characters" | "objects";

type KitSelection = { kind: KitKey; id: string };

function ensureTwoTextStyles(style: Style): Style {
  const d = createDefaultStyle().textStyles;
  const next = [...style.textStyles];
  while (next.length < 2) {
    next.push({ ...d[next.length]! });
  }
  return { ...style, textStyles: next };
}

function normalizeCharacterIds(list: StyleAsset[]): StyleAsset[] {
  return renumberCharacterKitIds(list);
}

function normalizeObjectIds(list: StyleAsset[]): StyleAsset[] {
  return renumberObjectKitIds(list);
}

export function StylePageView({ step: _step }: Props) {
  const ensureDraft = useStore(useProjectStore, (s) => s.ensureDraftProject);
  const updateStyle = useStore(useProjectStore, (s) => s.updateStyle);
  const style = useStore(useProjectStore, selectResolvedStyle);

  const [pngError, setPngError] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  /** Local hex field while typing (commit on blur). */
  const [backgroundHexDraft, setBackgroundHexDraft] = useState<string | null>(null);
  const [kitSelection, setKitSelection] = useState<KitSelection | null>(null);

  useEffect(() => {
    ensureDraft();
    updateStyle((s) => {
      const next = ensureTwoTextStyles(s);
      return {
        ...next,
        characters: normalizeCharacterIds(next.characters),
        objects: normalizeObjectIds(next.objects),
      };
    });
  }, [ensureDraft, updateStyle]);

  useEffect(() => {
    setKitSelection((prev) => {
      if (prev) {
        const list = style[prev.kind];
        if (list.some((a) => a.id === prev.id)) return prev;
      }
      const first = style.characters[0];
      if (first?.id) return { kind: "characters", id: first.id };
      return null;
    });
  }, [style.characters, style.objects]);

  useEffect(() => {
    setBackgroundHexDraft(null);
  }, [style.background.color]);

  const kitFileInputRef = useRef<HTMLInputElement>(null);
  const backgroundFileInputRef = useRef<HTMLInputElement>(null);
  const pickKitTargetRef = useRef<{ kind: KitKey; id: string } | null>(null);

  const patchKitAsset = (kind: KitKey, id: string, patch: Partial<StyleAsset>) => {
    updateStyle((s) => {
      const list = s[kind];
      const idx = list.findIndex((a) => a.id === id);
      if (idx === -1) return s;
      const prev = list[idx]!;
      const { id: _omitPatchId, ...patchRest } = patch;
      let merged: StyleAsset = { ...prev, ...patchRest, id: prev.id };
      if (kind === "objects") {
        const { description: _omit, ...rest } = merged;
        merged = rest;
      }
      const next = [...list];
      next[idx] = merged;
      return { ...s, [kind]: next };
    });
  };

  const removeKitAsset = (kind: KitKey, id: string) => {
    setKitSelection((sel) => (sel?.kind === kind && sel.id === id ? null : sel));
    updateStyle((s) => {
      const filtered = s[kind].filter((a) => a.id !== id);
      const next =
        kind === "characters" ? normalizeCharacterIds(filtered) : normalizeObjectIds(filtered);
      return { ...s, [kind]: next };
    });
  };

  const toggleKitSelection = (kind: KitKey, id: string) => {
    setKitSelection((prev) => {
      if (prev?.kind === kind && prev.id === id) {
        const first = style.characters[0];
        if (first?.id) return { kind: "characters", id: first.id };
        return null;
      }
      return { kind, id };
    });
  };

  const addKitPlaceholder = (kind: KitKey) => {
    updateStyle((s) => {
      const list = s[kind];
      const row: StyleAsset =
        kind === "characters"
          ? { id: "", name: "", description: "" }
          : { id: "", name: "" };
      const merged = [...list, row];
      const next =
        kind === "characters" ? normalizeCharacterIds(merged) : normalizeObjectIds(merged);
      return { ...s, [kind]: next };
    });
  };

  const openKitImagePicker = (kind: KitKey, id: string) => {
    setPngError(null);
    pickKitTargetRef.current = { kind, id };
    kitFileInputRef.current?.click();
  };

  const onBackgroundFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const result = await validateBackgroundImageFile(file);
    if (!result.ok) {
      setBackgroundError(result.reason);
      return;
    }
    setBackgroundError(null);
    updateStyle((s) => ({
      ...s,
      background: { ...s.background, src: result.dataUrl },
    }));
  };

  const clearBackgroundImage = () => {
    setBackgroundError(null);
    updateStyle((s) => ({
      ...s,
      background: { color: s.background.color },
    }));
  };

  const onKitFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = pickKitTargetRef.current;
    const file = e.target.files?.[0];
    e.target.value = "";
    pickKitTargetRef.current = null;
    if (!target || !file) return;

    const result = await validateTransparentStylePng(file);
    if (!result.ok) {
      setPngError(result.reason);
      return;
    }
    setPngError(null);
    patchKitAsset(target.kind, target.id, {
      src: result.dataUrl,
      width: result.width,
      height: result.height,
    });
  };

  const kitHoverDetail = useMemo((): StylePreviewKitHover | null => {
    if (!kitSelection) return null;
    const list = style[kitSelection.kind];
    const asset = list.find((a) => a.id === kitSelection.id);
    if (!asset) return null;
    const desc = asset.description?.trim();
    return {
      id: asset.id,
      name: asset.name,
      ...(desc ? { description: desc } : {}),
      kind: kitSelection.kind,
    };
  }, [kitSelection, style]);

  const backgroundColorHex = normalizeHex(style.background.color);
  const backgroundHexShown = backgroundHexDraft ?? backgroundColorHex;

  const commitBackgroundHex = (raw: string) => {
    const t = raw.trim();
    if (/^#[0-9A-Fa-f]{6}$/i.test(t)) {
      updateStyle((s) => ({
        ...s,
        background: { ...s.background, color: t.toLowerCase() },
      }));
      setBackgroundHexDraft(null);
      return;
    }
    if (/^#[0-9A-Fa-f]{3}$/i.test(t)) {
      const n = normalizeHex(t);
      updateStyle((s) => ({
        ...s,
        background: { ...s.background, color: n },
      }));
      setBackgroundHexDraft(null);
      return;
    }
    setBackgroundHexDraft(null);
  };

  const backgroundEditor = (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">Background</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="archive-text w-12 shrink-0 text-sm text-muted-foreground">Color</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
          <input
            type="color"
            className={cn(
              "h-8 w-8 shrink-0 cursor-pointer appearance-none overflow-hidden rounded-lg border border-input bg-transparent p-0 shadow-none outline-none transition-colors [color-scheme:dark] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
              "[&::-webkit-color-swatch-wrapper]:p-0",
              "[&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-lg",
              "[&::-moz-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-lg",
            )}
            value={backgroundColorHex}
            onChange={(e) =>
              updateStyle((s) => ({
                ...s,
                background: { ...s.background, color: e.target.value },
              }))
            }
            aria-label="Background color"
          />
          <Input
            className="archive-text font-mono h-8 w-[7.5rem] shrink-0 px-2 py-0 text-base"
            value={backgroundHexShown}
            onChange={(e) => setBackgroundHexDraft(e.target.value)}
            onBlur={() => {
              if (backgroundHexDraft === null) return;
              commitBackgroundHex(backgroundHexDraft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Background color hex"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="archive-text w-12 shrink-0 text-sm text-muted-foreground">Image</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input
            ref={backgroundFileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onBackgroundFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer text-sm"
            onClick={() => {
              setBackgroundError(null);
              backgroundFileInputRef.current?.click();
            }}
          >
            {style.background.src?.trim() ? "Replace file" : "Choose file"}
          </Button>
          {style.background.src?.trim() ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearBackgroundImage}>
              Remove image
            </Button>
          ) : null}
        </div>
      </div>

      {backgroundError ? (
        <p className="archive-text text-sm text-destructive">{backgroundError}</p>
      ) : null}
    </div>
  );

  return (
    <WorkflowStepLayout
      primary={
        <div className="flex w-full min-w-0 max-w-[min(100%,42rem)] flex-col gap-8 pt-2">
          {pngError ? (
            <p className="archive-text rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
              {pngError}
            </p>
          ) : null}

          <div className="flex flex-col gap-8">
            <input
              ref={kitFileInputRef}
              type="file"
              accept="image/png"
              className="sr-only"
              onChange={onKitFileChange}
            />

            <KitSection
              kind="characters"
              label="Characters"
              addLabel="Add character"
              emptyMessage="Nothing here yet"
              assets={style.characters}
              selection={kitSelection}
              onToggleSelect={toggleKitSelection}
              onAddLine={() => addKitPlaceholder("characters")}
              onPatch={(id, patch) => patchKitAsset("characters", id, patch)}
              onPickImage={(id) => openKitImagePicker("characters", id)}
              onRemove={(id) => removeKitAsset("characters", id)}
            />

            <KitSection
              kind="objects"
              label="Objects"
              addLabel="Add object"
              emptyMessage="Nothing here yet"
              assets={style.objects}
              selection={kitSelection}
              onToggleSelect={toggleKitSelection}
              onAddLine={() => addKitPlaceholder("objects")}
              onPatch={(id, patch) => patchKitAsset("objects", id, patch)}
              onPickImage={(id) => openKitImagePicker("objects", id)}
              onRemove={(id) => removeKitAsset("objects", id)}
            />
          </div>
        </div>
      }
      preview={
        <WorkflowPreviewColumn>
          <StylePreview
            style={style}
            kitHoverDetail={kitHoverDetail}
            backgroundEditor={backgroundEditor}
            className="w-full"
          />
        </WorkflowPreviewColumn>
      }
    />
  );
}

const kitTileIconBtn =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border/40 transition-[color,background-color] hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const kitTileActionsRow =
  "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-2 pt-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100";

function KitThumbnailTile({
  kind,
  label,
  asset,
  index,
  isSelected,
  onToggleSelect,
  onPatch,
  onPickImage,
  onRemove,
}: {
  kind: KitKey;
  label: string;
  asset: StyleAsset;
  index: number;
  isSelected: boolean;
  onToggleSelect: (kind: KitKey, id: string) => void;
  onPatch: (id: string, patch: Partial<StyleAsset>) => void;
  onPickImage: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [broken, setBroken] = useState(false);
  const raw = asset.src?.trim() ?? "";
  useEffect(() => {
    setBroken(false);
  }, [raw]);

  const hasImage = Boolean(raw) && !broken;
  const src = hasImage ? raw : PLACEHOLDER_PNG;
  const rowLabel = `${label} ${index + 1}`;

  return (
    <li className="min-w-0 list-none">
      <div
        className={cn(
          "group relative flex aspect-square w-full flex-col overflow-hidden rounded-sm ring-1 transition-[box-shadow]",
          isSelected ? "ring-white" : "ring-foreground/10",
        )}
      >
        <button
          type="button"
          className="relative z-0 flex min-h-0 w-full flex-1 cursor-pointer items-center justify-center bg-muted/30 p-1"
          onClick={() => onToggleSelect(kind, asset.id)}
          aria-label={`Select ${rowLabel}`}
          aria-pressed={isSelected}
        >
          <img
            src={src}
            alt=""
            className={cn("max-h-full max-w-full object-contain", !hasImage && "opacity-55")}
            onError={() => {
              if (raw) setBroken(true);
            }}
          />
        </button>
        <div
          className="flex shrink-0 items-center gap-1 border-t border-border/25 bg-background/90 px-1.5 py-1"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span
            className={cn(
              "shrink-0 text-[13px] leading-none text-muted-foreground",
              kind === "characters" && "uppercase",
            )}
            aria-hidden
          >
            {asset.id}
          </span>
          <label htmlFor={`asset-name-${kind}-${asset.id}`} className="sr-only">
            {rowLabel} name
          </label>
          <Input
            id={`asset-name-${kind}-${asset.id}`}
            className={cn(
              "archive-text h-7 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-base leading-tight shadow-none",
              "dark:bg-transparent",
              "placeholder:text-muted-foreground/50",
              "focus-visible:border-transparent focus-visible:ring-0",
            )}
            placeholder="Name"
            value={asset.name}
            onChange={(e) => onPatch(asset.id, { name: e.target.value })}
            aria-label={`${asset.id}, ${label} name`}
          />
        </div>
        <div className={kitTileActionsRow}>
          <button
            type="button"
            className={kitTileIconBtn}
            onClick={() => onPickImage(asset.id)}
            aria-label={raw ? "Replace PNG" : "Add PNG"}
          >
            <ImagePlus className="size-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className={cn(kitTileIconBtn, "hover:text-destructive")}
            onClick={() => onRemove(asset.id)}
            aria-label={`Remove ${rowLabel}`}
          >
            <Trash2 className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

function KitSection({
  kind,
  label,
  addLabel,
  emptyMessage,
  assets,
  selection,
  onToggleSelect,
  onAddLine,
  onPatch,
  onPickImage,
  onRemove,
}: {
  kind: KitKey;
  label: string;
  addLabel: string;
  emptyMessage: string;
  assets: StyleAsset[];
  selection: KitSelection | null;
  onToggleSelect: (kind: KitKey, id: string) => void;
  onAddLine: () => void;
  onPatch: (id: string, patch: Partial<StyleAsset>) => void;
  onPickImage: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <button
          type="button"
          onClick={onAddLine}
          className="archive-text text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {addLabel}
        </button>
      </div>

      <div className="flex flex-col">
        {assets.length === 0 ? (
          <p className="archive-text-muted py-4 text-center">{emptyMessage}</p>
        ) : (
          <ul className="grid list-none grid-cols-4 gap-2 p-0 sm:gap-3">
            {assets.map((asset, index) => {
              const isSelected = selection?.kind === kind && selection.id === asset.id;
              return (
                <KitThumbnailTile
                  key={asset.id}
                  kind={kind}
                  label={label}
                  asset={asset}
                  index={index}
                  isSelected={isSelected}
                  onToggleSelect={onToggleSelect}
                  onPatch={onPatch}
                  onPickImage={onPickImage}
                  onRemove={onRemove}
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
