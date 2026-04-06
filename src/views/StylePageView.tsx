import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { RenderActivityFloatingDock } from "@/components/RenderActivityFloatingDock";
import { WorkflowStepPage } from "@/components/WorkflowStepPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { panelHeadingClass } from "@/lib/panelHeading";
import { renumberCharacterKitIds } from "@/lib/kitAssetId";
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

type KitSelection = { id: string };

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

export function StylePageView({ step: _step }: Props) {
  const ensureDraft = useStore(useProjectStore, (s) => s.ensureDraftProject);
  const updateStyle = useStore(useProjectStore, (s) => s.updateStyle);
  const patchScene = useStore(useProjectStore, (s) => s.patchScene);
  const requestKitAssetRender = useStore(useProjectStore, (s) => s.requestKitAssetRender);
  const kitAssetGeneratingKeys = useStore(useProjectStore, (s) => s.kitAssetGeneratingKeys);
  const assetBundle = useStore(useProjectStore, selectResolvedStyleBundle);
  const renders = useStore(useProjectStore, (s) => s.renders);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const frames = useStore(useProjectStore, (s) => s.frames);

  const sortedScenes = useMemo(() => [...scenes].sort((a, b) => a.index - b.index), [scenes]);

  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [sceneRefError, setSceneRefError] = useState<string | null>(null);
  const sceneRefUploadTargetRef = useRef<string | null>(null);
  const sceneRefFileInputRef = useRef<HTMLInputElement>(null);

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
      };
    });
  }, [ensureDraft, updateStyle]);

  useEffect(() => {
    setSelectedSceneId((prev) => {
      if (sortedScenes.length === 0) return null;
      if (prev && sortedScenes.some((s) => s.id === prev)) return prev;
      return sortedScenes[0]!.id;
    });
  }, [sortedScenes]);

  const selectedScene = useMemo(
    () => (selectedSceneId ? sortedScenes.find((s) => s.id === selectedSceneId) ?? null : null),
    [sortedScenes, selectedSceneId],
  );

  useEffect(() => {
    setKitSelection((prev) => {
      if (prev) {
        const list = assetBundle.characters;
        if (list.some((a) => a.id === prev.id)) return prev;
      }
      const first = assetBundle.characters[0];
      if (first?.id) return { id: first.id };
      return null;
    });
  }, [assetBundle.characters]);

  useEffect(() => {
    setBackgroundHexDraft(null);
  }, [assetBundle.background.color]);

  const backgroundFileInputRef = useRef<HTMLInputElement>(null);

  const patchKitAsset = (id: string, patch: Partial<KitAsset>) => {
    updateStyle((s) => {
      const list = s.characters;
      const idx = list.findIndex((a) => a.id === id);
      if (idx === -1) return s;
      const prev = list[idx]!;
      const { id: _omitPatchId, ...patchRest } = patch;
      const merged: KitAsset = { ...prev, ...patchRest, id: prev.id };
      const next = [...list];
      next[idx] = merged;
      return { ...s, characters: next };
    });
  };

  const removeKitAsset = (id: string) => {
    setKitSelection((sel) => (sel?.id === id ? null : sel));
    updateStyle((s) => {
      const filtered = s.characters.filter((a) => a.id !== id);
      return { ...s, characters: normalizeCharacterIds(filtered) };
    });
  };

  const toggleKitSelection = (id: string) => {
    setKitSelection((prev) => {
      if (prev?.id === id) {
        const first = assetBundle.characters[0];
        if (first?.id) return { id: first.id };
        return null;
      }
      return { id };
    });
  };

  const addCharacterPlaceholder = () => {
    updateStyle((s) => {
      const list = s.characters;
      const row: KitAsset = { id: "", name: "", description: "" };
      const merged = [...list, row];
      return { ...s, characters: normalizeCharacterIds(merged) };
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

  const onSceneReferenceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const sid = sceneRefUploadTargetRef.current;
    sceneRefUploadTargetRef.current = null;
    if (!file || !sid) return;
    const result = await validateBackgroundImageFile(file);
    if (!result.ok) {
      setSceneRefError(result.reason);
      return;
    }
    setSceneRefError(null);
    patchScene(sid, { referenceImageSrc: result.dataUrl });
  };

  const triggerSceneReferenceUpload = (sceneId: string) => {
    setSceneRefError(null);
    sceneRefUploadTargetRef.current = sceneId;
    sceneRefFileInputRef.current?.click();
  };

  const clearSceneReference = (sceneId: string) => {
    setSceneRefError(null);
    patchScene(sceneId, { referenceImageSrc: undefined });
  };

  const kitAssetRenderRowLabel = useCallback((r: Render) => {
    const t = r.kitTarget;
    if (t?.kind === "characters") return `Character ${t.assetId}`;
    if (t?.kind === "objects") return `Object ${t.assetId}`;
    return "Kit render";
  }, []);

  const selectedCharacter = useMemo(() => {
    if (!kitSelection) return null;
    return assetBundle.characters.find((a) => a.id === kitSelection.id) ?? null;
  }, [kitSelection, assetBundle.characters]);

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
    <div className="flex flex-col gap-4">
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

  const selectedSceneRefRaw = selectedScene?.referenceImageSrc?.trim() ?? "";
  const selectedSceneRefDisplay = selectedSceneRefRaw ? kitAssetDisplaySrc(selectedSceneRefRaw) : "";

  return (
    <WorkflowStepPage
      middleColumnWide
      primaryClassName="gap-6"
      middleClassName="gap-3 bg-background lg:pb-3"
      primary={
        <>
          <div className="flex flex-col gap-2">
            <p className={panelHeadingClass}>Description</p>
            <label htmlFor="style-description" className="sr-only">
              Style description
            </label>
            <Textarea
              id="style-description"
              className="archive-text min-h-[3.5rem] resize-y text-base leading-snug"
              placeholder="Overall look, tone, and constraints for this film…"
              value={assetBundle.description}
              onChange={(e) => updateStyle((s) => ({ ...s, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Scene references</p>
            <input
              ref={sceneRefFileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onSceneReferenceFileChange}
            />
            {sceneRefError ? (
              <p className="archive-text text-sm text-destructive">{sceneRefError}</p>
            ) : null}
            <div
              className={cn(
                "flex max-h-[min(50vh,22rem)] min-h-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-muted/25 shadow-sm ring-1 ring-foreground/[0.06]",
              )}
            >
              <ul className="flex min-h-0 list-none flex-col gap-0 overflow-y-auto p-1" role="list">
                {sortedScenes.map((sc) => {
                  const title = sc.title.trim() || `Scene ${sc.index + 1}`;
                  const refRaw = sc.referenceImageSrc?.trim() ?? "";
                  const thumb = refRaw ? kitAssetDisplaySrc(refRaw) : "";
                  const isSelected = selectedSceneId === sc.id;
                  return (
                    <li key={sc.id} className="list-none">
                      <div
                        className={cn(
                          "flex min-w-0 items-center gap-2 rounded-sm py-1 pl-1 pr-1",
                          isSelected ? "bg-muted/90" : "",
                        )}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 min-h-0 flex-1 cursor-pointer items-center gap-2 rounded-sm py-0.5 text-left text-base leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                          onClick={() => setSelectedSceneId(sc.id)}
                          aria-pressed={isSelected}
                        >
                          <span className="relative h-6 w-10 shrink-0 overflow-hidden rounded-[2px] bg-muted">
                            {thumb ? (
                              <img src={thumb} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{title}</span>
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 cursor-pointer text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerSceneReferenceUpload(sc.id);
                          }}
                        >
                          {refRaw ? "Replace" : "Add"}
                        </Button>
                        {refRaw ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 cursor-pointer text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearSceneReference(sc.id);
                            }}
                          >
                            Clear
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {backgroundEditor}
        </>
      }
      middle={
        <>
          <p className={panelHeadingClass}>Preview</p>
          <div
            className="relative box-border aspect-video w-full min-h-0 shrink-0 overflow-hidden rounded-md border-2 border-dotted border-muted-foreground/45 bg-black"
            role="region"
            aria-label="Scene reference preview"
          >
            {selectedSceneRefDisplay ? (
              <img
                src={selectedSceneRefDisplay}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <p className="archive-text text-center text-sm text-muted-foreground">
                  {selectedScene
                    ? "No reference image for this scene — use Add on the left."
                    : "No scenes in the script."}
                </p>
              </div>
            )}
          </div>
        </>
      }
      preview={
        <>
          <KitSection
            label="Characters"
            addLabel="Add character"
            emptyMessage="Nothing here yet"
            assets={assetBundle.characters}
            generatingKeys={kitAssetGeneratingKeys}
            selection={kitSelection}
            onToggleSelect={toggleKitSelection}
            onAddLine={addCharacterPlaceholder}
            onPatch={patchKitAsset}
            onGenerateAsset={(id) => void requestKitAssetRender("characters", id)}
            onRemove={removeKitAsset}
          />
          {selectedCharacter ? (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Character</p>
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="shrink-0 text-[13px] uppercase leading-none text-muted-foreground"
                    aria-hidden
                  >
                    {selectedCharacter.id}
                  </span>
                  <label htmlFor={`style-char-name-${selectedCharacter.id}`} className="sr-only">
                    Character name
                  </label>
                  <Input
                    id={`style-char-name-${selectedCharacter.id}`}
                    className="archive-text min-w-0 flex-1 text-base"
                    placeholder="Name"
                    value={selectedCharacter.name}
                    onChange={(e) => patchKitAsset(selectedCharacter.id, { name: e.target.value })}
                    aria-label={`${selectedCharacter.id}, character name`}
                  />
                </div>
              </div>
              <div className="flex min-h-0 flex-col gap-2">
                <label
                  htmlFor={`style-char-desc-${selectedCharacter.id}`}
                  className="text-xs font-medium uppercase text-muted-foreground"
                >
                  Prompt
                </label>
                <Textarea
                  id={`style-char-desc-${selectedCharacter.id}`}
                  className="archive-text min-h-[6rem] flex-1 resize-y text-sm leading-snug"
                  placeholder="Appearance, role, and how they read on screen…"
                  value={selectedCharacter.description ?? ""}
                  onChange={(e) =>
                    patchKitAsset(selectedCharacter.id, { description: e.target.value })
                  }
                  rows={6}
                  aria-label={`${selectedCharacter.id}, character prompt`}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Character</p>
              <p className="archive-text text-sm text-muted-foreground">
                Select a character in the grid to edit.
              </p>
            </div>
          )}
          <RenderActivityFloatingDock
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
  label: string;
  asset: KitAsset;
  index: number;
  isSelected: boolean;
  /** Store-driven: this row’s image is being generated (parallel batch). */
  isGenerating: boolean;
  onToggleSelect: (id: string) => void;
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
          onClick={() => onToggleSelect(asset.id)}
          aria-label={`Select ${rowLabel}`}
          aria-pressed={isSelected}
          aria-busy={isGenerating}
        >
          {showImage ? (
            <img
              key={`char-${asset.id}-${raw ? String(raw.length) : "0"}`}
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
            className="shrink-0 text-[13px] uppercase leading-none text-muted-foreground"
            aria-hidden
          >
            {asset.id}
          </span>
          <label htmlFor={`asset-name-char-${asset.id}`} className="sr-only">
            {rowLabel} name
          </label>
          <Input
            id={`asset-name-char-${asset.id}`}
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
  label: string;
  addLabel: string;
  emptyMessage: string;
  assets: KitAsset[];
  generatingKeys: Record<string, true>;
  selection: KitSelection | null;
  onToggleSelect: (id: string) => void;
  onAddLine: () => void;
  onPatch: (id: string, patch: Partial<KitAsset>) => void;
  onGenerateAsset: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className={panelHeadingClass}>{label}</p>
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
          <ul className="grid list-none grid-cols-3 gap-3 p-0 sm:gap-4">
            {assets.map((asset, index) => {
              const isSelected = selection?.id === asset.id;
              const isGenerating = Boolean(
                generatingKeys[kitAssetGeneratingKey("characters", asset.id)],
              );
              return (
                <KitThumbnailTile
                  key={asset.id}
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
