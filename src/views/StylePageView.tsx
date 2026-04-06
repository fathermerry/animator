import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { RenderActivityFloatingDock } from "@/components/RenderActivityFloatingDock";
import { StylePreview, type StylePreviewKitHover } from "@/components/StylePreview";
import { WorkflowPreviewColumn } from "@/components/WorkflowPreviewColumn";
import { WorkflowStepLayout } from "@/components/WorkflowStepLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  renumberCharacterKitIds,
  renumberObjectKitIds,
} from "@/lib/kitAssetId";
import { normalizeHex } from "@/lib/color";
import { kitAssetDisplaySrc } from "@/lib/kitAssetDisplaySrc";
import { validateBackgroundImageFile } from "@/lib/kitAssetPng";
import { cn } from "@/lib/utils";
import {
  kitAssetGeneratingKey,
  selectResolvedStyleBundle,
  useProjectStore,
} from "@/store/projectStore";
import type { Step } from "@/steps";
import type { Render } from "@/types/project";
import { createDefaultAssetBundle, type AssetBundle, type KitAsset } from "@/types/styleConfig";
import { Sparkles, Trash2 } from "lucide-react";

type Props = { step: Step };

type KitKey = "characters" | "objects";

type KitSelection = { kind: KitKey; id: string };

function ensureTwoTextStyles(bundle: AssetBundle): AssetBundle {
  const d = createDefaultAssetBundle().textStyles;
  const next = [...bundle.textStyles];
  while (next.length < 2) {
    next.push({ ...d[next.length]! });
  }
  return { ...bundle, textStyles: next };
}

function normalizeCharacterIds(list: KitAsset[]): KitAsset[] {
  return renumberCharacterKitIds(list);
}

function normalizeObjectIds(list: KitAsset[]): KitAsset[] {
  return renumberObjectKitIds(list);
}

export function StylePageView({ step: _step }: Props) {
  const ensureDraft = useStore(useProjectStore, (s) => s.ensureDraftProject);
  const updateStyle = useStore(useProjectStore, (s) => s.updateStyle);
  const requestKitAssetsRender = useStore(useProjectStore, (s) => s.requestKitAssetsRender);
  const requestKitAssetRender = useStore(useProjectStore, (s) => s.requestKitAssetRender);
  const generatingKitAssets = useStore(useProjectStore, (s) => s.generatingKitAssets);
  const kitAssetGeneratingKeys = useStore(useProjectStore, (s) => s.kitAssetGeneratingKeys);
  const assetBundle = useStore(useProjectStore, selectResolvedStyleBundle);
  const renders = useStore(useProjectStore, (s) => s.renders);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const frames = useStore(useProjectStore, (s) => s.frames);

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
        const list = assetBundle[prev.kind];
        if (list.some((a) => a.id === prev.id)) return prev;
      }
      const first = assetBundle.characters[0];
      if (first?.id) return { kind: "characters", id: first.id };
      return null;
    });
  }, [assetBundle.characters, assetBundle.objects]);

  useEffect(() => {
    setBackgroundHexDraft(null);
  }, [assetBundle.background.color]);

  const backgroundFileInputRef = useRef<HTMLInputElement>(null);

  const patchKitAsset = (kind: KitKey, id: string, patch: Partial<KitAsset>) => {
    updateStyle((s) => {
      const list = s[kind];
      const idx = list.findIndex((a) => a.id === id);
      if (idx === -1) return s;
      const prev = list[idx]!;
      const { id: _omitPatchId, ...patchRest } = patch;
      let merged: KitAsset = { ...prev, ...patchRest, id: prev.id };
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
        const first = assetBundle.characters[0];
        if (first?.id) return { kind: "characters", id: first.id };
        return null;
      }
      return { kind, id };
    });
  };

  const addKitPlaceholder = (kind: KitKey) => {
    updateStyle((s) => {
      const list = s[kind];
      const row: KitAsset =
        kind === "characters"
          ? { id: "", name: "", description: "" }
          : { id: "", name: "" };
      const merged = [...list, row];
      const next =
        kind === "characters" ? normalizeCharacterIds(merged) : normalizeObjectIds(merged);
      return { ...s, [kind]: next };
    });
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

  const kitAssetRenderRowLabel = useCallback((r: Render) => {
    const t = r.kitTarget;
    if (t?.kind === "characters") return `Character ${t.assetId}`;
    if (t?.kind === "objects") return `Object ${t.assetId}`;
    return "Kit render";
  }, []);

  const kitAssetCount = assetBundle.characters.length + assetBundle.objects.length;

  const kitGenerateDisabled = generatingKitAssets || kitAssetCount === 0;

  const kitHoverDetail = useMemo((): StylePreviewKitHover | null => {
    if (!kitSelection) return null;
    const list = assetBundle[kitSelection.kind];
    const asset = list.find((a) => a.id === kitSelection.id);
    if (!asset) return null;
    const desc = asset.description?.trim();
    return {
      id: asset.id,
      name: asset.name,
      ...(desc ? { description: desc } : {}),
      kind: kitSelection.kind,
    };
  }, [kitSelection, assetBundle]);

  const backgroundColorHex = normalizeHex(assetBundle.background.color);
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
            {assetBundle.background.src?.trim() ? "Replace file" : "Choose file"}
          </Button>
          {assetBundle.background.src?.trim() ? (
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
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Description</p>
              <label htmlFor="style-description" className="sr-only">
                Style description
              </label>
              <Textarea
                id="style-description"
                className="archive-text min-h-[4.5rem] resize-y text-base leading-snug"
                placeholder="Overall look, tone, and constraints for this film…"
                value={assetBundle.description}
                onChange={(e) => updateStyle((s) => ({ ...s, description: e.target.value }))}
                rows={4}
              />
            </div>

            <KitSection
              kind="characters"
              label="Characters"
              addLabel="Add character"
              emptyMessage="Nothing here yet"
              assets={assetBundle.characters}
              generatingKeys={kitAssetGeneratingKeys}
              selection={kitSelection}
              onToggleSelect={toggleKitSelection}
              onAddLine={() => addKitPlaceholder("characters")}
              onPatch={(id, patch) => patchKitAsset("characters", id, patch)}
              onGenerateAsset={(id) => void requestKitAssetRender("characters", id)}
              onRemove={(id) => removeKitAsset("characters", id)}
            />

            <KitSection
              kind="objects"
              label="Objects"
              addLabel="Add object"
              emptyMessage="Nothing here yet"
              assets={assetBundle.objects}
              generatingKeys={kitAssetGeneratingKeys}
              selection={kitSelection}
              onToggleSelect={toggleKitSelection}
              onAddLine={() => addKitPlaceholder("objects")}
              onPatch={(id, patch) => patchKitAsset("objects", id, patch)}
              onGenerateAsset={(id) => void requestKitAssetRender("objects", id)}
              onRemove={(id) => removeKitAsset("objects", id)}
            />
          </div>
        </div>
      }
      preview={
        <>
          <WorkflowPreviewColumn>
            <StylePreview
              assetBundle={assetBundle}
              kitHoverDetail={kitHoverDetail}
              onPatchKitDetail={
                kitSelection
                  ? (patch) => patchKitAsset(kitSelection.kind, kitSelection.id, patch)
                  : undefined
              }
              backgroundEditor={backgroundEditor}
              className="w-full"
            />
          </WorkflowPreviewColumn>
          <RenderActivityFloatingDock
            primary={{
              label: "Generate assets",
              onClick: () => void requestKitAssetsRender(),
              disabled: kitGenerateDisabled,
              ariaLabel: "Generate assets",
            }}
            renders={renders}
            renderScope="asset"
            scenes={scenes}
            frames={frames}
            renderRowLabel={kitAssetRenderRowLabel}
            title="Renders"
          />
        </>
      }
    />
  );
}

const kitTileIconBtn =
  "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border/40 transition-[color,background-color] hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background/90 disabled:hover:text-muted-foreground";

const kitTileActionsRow =
  "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-2 pt-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100";

function KitThumbnailTile({
  kind,
  label,
  asset,
  index,
  isSelected,
  isGenerating,
  onToggleSelect,
  onPatch,
  onGenerateAsset,
  onRemove,
}: {
  kind: KitKey;
  label: string;
  asset: KitAsset;
  index: number;
  isSelected: boolean;
  /** Store-driven: this row’s image is being generated (parallel batch). */
  isGenerating: boolean;
  onToggleSelect: (kind: KitKey, id: string) => void;
  onPatch: (id: string, patch: Partial<KitAsset>) => void;
  onGenerateAsset: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [broken, setBroken] = useState(false);
  const raw = asset.src?.trim() ?? "";
  useEffect(() => {
    setBroken(false);
  }, [raw]);
  /** After a batch finishes, retry load in case a prior attempt 404’d and left `broken` stuck. */
  useEffect(() => {
    if (!isGenerating) setBroken(false);
  }, [isGenerating]);

  const displaySrc = kitAssetDisplaySrc(raw);
  const hasImage = Boolean(raw) && !broken;
  const showImage = hasImage && Boolean(displaySrc);
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
          className={cn(
            "relative z-0 flex min-h-0 w-full flex-1 cursor-pointer overflow-hidden p-0 transition-colors duration-300",
            isGenerating ? "kit-tile-generating-bg" : "bg-muted/30",
          )}
          onClick={() => onToggleSelect(kind, asset.id)}
          aria-label={`Select ${rowLabel}`}
          aria-pressed={isSelected}
          aria-busy={isGenerating}
        >
          {showImage ? (
            <img
              key={`${kind}-${asset.id}-${raw ? String(raw.length) : "0"}`}
              src={displaySrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => {
                if (raw) setBroken(true);
              }}
            />
          ) : null}
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
            disabled={isGenerating}
            onClick={(e) => {
              e.stopPropagation();
              onGenerateAsset(asset.id);
            }}
            aria-label={isGenerating ? "Generating image…" : "Generate image with AI"}
          >
            <Sparkles className="size-4" strokeWidth={2} aria-hidden />
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
  generatingKeys,
  selection,
  onToggleSelect,
  onAddLine,
  onPatch,
  onGenerateAsset,
  onRemove,
}: {
  kind: KitKey;
  label: string;
  addLabel: string;
  emptyMessage: string;
  assets: KitAsset[];
  generatingKeys: Record<string, true>;
  selection: KitSelection | null;
  onToggleSelect: (kind: KitKey, id: string) => void;
  onAddLine: () => void;
  onPatch: (id: string, patch: Partial<KitAsset>) => void;
  onGenerateAsset: (id: string) => void;
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
              const isGenerating = Boolean(generatingKeys[kitAssetGeneratingKey(kind, asset.id)]);
              return (
                <KitThumbnailTile
                  key={asset.id}
                  kind={kind}
                  label={label}
                  asset={asset}
                  index={index}
                  isSelected={isSelected}
                  isGenerating={isGenerating}
                  onToggleSelect={onToggleSelect}
                  onPatch={onPatch}
                  onGenerateAsset={onGenerateAsset}
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
