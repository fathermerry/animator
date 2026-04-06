import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { StyleSceneReferencePreview } from "@/components/StyleSceneReferencePreview";
import { WorkflowPreviewColumn } from "@/components/WorkflowPreviewColumn";
import { WorkflowStepPage } from "@/components/WorkflowStepPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { panelHeadingAfterBlockClass, panelHeadingClass } from "@/lib/panelHeading";
import { renumberCharacterKitIds } from "@/lib/kitAssetId";
import { normalizeHex } from "@/lib/color";
import { kitAssetDisplaySrc } from "@/lib/kitAssetDisplaySrc";
import { normalizeCharacterKitImageSrcs } from "@/lib/kitAssetImages";
import { validateBackgroundImageFile } from "@/lib/kitAssetPng";
import { resolveSceneBackground } from "@/lib/sceneBackground";
import { cn } from "@/lib/utils";
import {
  kitAssetGeneratingKey,
  selectResolvedStyleBundle,
  useProjectStore,
} from "@/store/projectStore";
import type { Step } from "@/steps";
import type { Scene } from "@/types/project";
import { createDefaultAssetBundle, type AssetBundle, type KitAsset } from "@/types/styleConfig";
import { Popover } from "@base-ui/react/popover";
import { Pencil, Sparkles, X } from "lucide-react";

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

const kitTileIconBtn =
  "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border/40 transition-[color,background-color] hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background/90 disabled:hover:text-muted-foreground";

const kitTileActionsRow =
  "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-2 pt-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100";

export function StylePageView({ step: _step }: Props) {
  const ensureDraft = useStore(useProjectStore, (s) => s.ensureDraftProject);
  const updateStyle = useStore(useProjectStore, (s) => s.updateStyle);
  const patchScene = useStore(useProjectStore, (s) => s.patchScene);
  const requestSceneReferenceRender = useStore(useProjectStore, (s) => s.requestSceneReferenceRender);
  const sceneReferenceGeneratingKeys = useStore(useProjectStore, (s) => s.sceneReferenceGeneratingKeys);
  const sceneReferenceRenderErrors = useStore(useProjectStore, (s) => s.sceneReferenceRenderErrors);
  const requestKitAssetRender = useStore(useProjectStore, (s) => s.requestKitAssetRender);
  const kitAssetGeneratingKeys = useStore(useProjectStore, (s) => s.kitAssetGeneratingKeys);
  const assetBundle = useStore(useProjectStore, selectResolvedStyleBundle);
  const scenes = useStore(useProjectStore, (s) => s.scenes);

  const sortedScenes = useMemo(() => [...scenes].sort((a, b) => a.index - b.index), [scenes]);

  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

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

  const selectedScene = useMemo(
    () => (selectedSceneId ? sortedScenes.find((s) => s.id === selectedSceneId) ?? null : null),
    [sortedScenes, selectedSceneId],
  );

  const resolvedScenePlate = useMemo(
    () => resolveSceneBackground(selectedScene, assetBundle),
    [selectedScene, assetBundle],
  );

  useEffect(() => {
    setBackgroundHexDraft(null);
  }, [selectedSceneId, resolvedScenePlate.color]);

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
    if (!file || !selectedSceneId) return;

    const result = await validateBackgroundImageFile(file);
    if (!result.ok) {
      setBackgroundError(result.reason);
      return;
    }
    setBackgroundError(null);
    patchScene(selectedSceneId, { backgroundImageSrc: result.dataUrl });
  };

  const clearBackgroundImage = () => {
    if (!selectedSceneId) return;
    setBackgroundError(null);
    patchScene(selectedSceneId, { backgroundImageSrc: undefined });
  };

  const clearSceneReference = (sceneId: string) => {
    patchScene(sceneId, { referenceImageSrc: undefined });
    useProjectStore.setState((s) => {
      const sceneReferenceRenderErrors = { ...s.sceneReferenceRenderErrors };
      delete sceneReferenceRenderErrors[sceneId];
      return { sceneReferenceRenderErrors };
    });
  };

  const backgroundColorHex = normalizeHex(resolvedScenePlate.color);
  const backgroundHexShown = backgroundHexDraft ?? backgroundColorHex;

  const commitBackgroundHex = (raw: string) => {
    if (!selectedSceneId) return;
    const t = raw.trim();
    if (/^#[0-9A-Fa-f]{6}$/i.test(t)) {
      patchScene(selectedSceneId, { backgroundColor: t.toLowerCase() });
      setBackgroundHexDraft(null);
      return;
    }
    if (/^#[0-9A-Fa-f]{3}$/i.test(t)) {
      const n = normalizeHex(t);
      patchScene(selectedSceneId, { backgroundColor: n });
      setBackgroundHexDraft(null);
      return;
    }
    setBackgroundHexDraft(null);
  };

  const sceneBackgroundEditor = (
    <div className="flex flex-col gap-4">
      <p className={panelHeadingAfterBlockClass}>Background</p>
      {!selectedScene ? (
        <p className="archive-text text-sm text-muted-foreground">No scenes yet.</p>
      ) : (
        <>
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
                  patchScene(selectedScene.id, { backgroundColor: e.target.value })
                }
                aria-label="Scene background color"
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
                aria-label="Scene background color hex"
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
                {resolvedScenePlate.src?.trim() ? "Replace file" : "Choose file"}
              </Button>
              {selectedScene.backgroundImageSrc?.trim() ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearBackgroundImage}>
                  Remove image
                </Button>
              ) : null}
            </div>
          </div>

          {backgroundError ? (
            <p className="archive-text text-sm text-destructive">{backgroundError}</p>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <>
      <WorkflowStepPage
        equalWidthColumns
        primaryClassName="gap-6"
        middleClassName="gap-4 bg-background lg:pb-3"
        panels={[
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
        </>,
        <>
          <div className="flex min-h-0 flex-col gap-2">
            <p className={panelHeadingClass}>Scenes</p>
            <div className="flex max-h-[min(26vh,11.25rem)] min-h-0 flex-col overflow-hidden rounded-lg border border-border/80">
              <ul className="flex min-h-0 list-none flex-col gap-0 overflow-y-auto p-1" role="list">
                {sortedScenes.map((sc) => {
                  const title = sc.title.trim() || `Scene ${sc.index + 1}`;
                  const refRaw = sc.referenceImageSrc?.trim() ?? "";
                  const thumb = refRaw ? kitAssetDisplaySrc(refRaw) : "";
                  const isSelected = selectedSceneId === sc.id;
                  const refGenerating = Boolean(sceneReferenceGeneratingKeys[sc.id]);
                  const refError = sceneReferenceRenderErrors[sc.id];
                  return (
                    <li key={sc.id} className="list-none">
                      <div
                        className={cn(
                          "flex min-w-0 flex-col gap-1 rounded-sm py-1 pl-1 pr-1",
                          isSelected ? "bg-muted/90" : "",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            className="flex min-w-0 min-h-0 flex-1 cursor-pointer items-center gap-2 rounded-sm py-0.5 text-left text-base leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                            onClick={() => setSelectedSceneId(sc.id)}
                            aria-pressed={isSelected}
                          >
                            <span
                              className={cn(
                                "relative h-6 w-10 shrink-0 overflow-hidden rounded-[2px] bg-muted",
                                refGenerating && "kit-tile-generating-bg",
                              )}
                            >
                              {thumb ? (
                                <img src={thumb} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{title}</span>
                          </button>
                          <button
                            type="button"
                            className={cn(kitTileIconBtn, "shrink-0")}
                            disabled={refGenerating}
                            onClick={(e) => {
                              e.stopPropagation();
                              void requestSceneReferenceRender(sc.id);
                            }}
                            aria-label={
                              refGenerating
                                ? "Generating scene reference…"
                                : "Generate scene reference with AI"
                            }
                            aria-busy={refGenerating}
                          >
                            <Sparkles className="size-4" strokeWidth={2} aria-hidden />
                          </button>
                          {refRaw ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0 cursor-pointer text-sm"
                              disabled={refGenerating}
                              onClick={(e) => {
                                e.stopPropagation();
                                clearSceneReference(sc.id);
                              }}
                            >
                              Clear
                            </Button>
                          ) : null}
                        </div>
                        {refError ? (
                          <p className="archive-text px-1 text-sm text-destructive">{refError}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <p className={panelHeadingAfterBlockClass}>Scene description</p>
            {selectedScene ? (
              <>
                <label htmlFor="style-scene-description" className="sr-only">
                  Scene description
                </label>
                <Textarea
                  id="style-scene-description"
                  className="archive-text min-h-[5rem] resize-y text-base leading-snug"
                  placeholder="Staging / beat copy: who does what with props…"
                  value={selectedScene.description}
                  onChange={(e) => patchScene(selectedScene.id, { description: e.target.value })}
                  rows={5}
                  aria-label={`Scene description, ${selectedScene.title.trim() || "scene"}`}
                />
                <SceneCharacterTagField
                  sceneId={selectedScene.id}
                  characterIds={selectedScene.characterIds}
                  kitCharacters={assetBundle.characters}
                  patchScene={patchScene}
                />
              </>
            ) : (
              <p className="archive-text text-sm text-muted-foreground">No scenes yet.</p>
            )}
          </div>
        </>,
        <WorkflowPreviewColumn>
          <StyleSceneReferencePreview scene={selectedScene} className="w-full shrink-0" />
          {sceneBackgroundEditor}
        </WorkflowPreviewColumn>,
      ]}
      />
    </>
  );
}

function SceneCharacterTagField({
  sceneId,
  characterIds,
  kitCharacters,
  patchScene,
}: {
  sceneId: string;
  characterIds: string[];
  kitCharacters: KitAsset[];
  patchScene: (id: string, patch: Partial<Scene>) => void;
}) {
  const available = useMemo(
    () => kitCharacters.filter((c) => !characterIds.includes(c.id)),
    [kitCharacters, characterIds],
  );

  return (
    <div className="flex flex-col gap-2">
      <p className={panelHeadingAfterBlockClass}>Characters</p>
      <label htmlFor={`scene-char-add-${sceneId}`} className="sr-only">
        Add character to scene
      </label>
      <div
        className={cn(
          "flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-2 py-2 shadow-xs",
          "dark:bg-input/30",
        )}
      >
        {characterIds.map((id) => {
          const kit = kitCharacters.find((c) => c.id === id);
          const name = kit?.name?.trim() ?? "";
          return (
            <span
              key={id}
              className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-border bg-muted/50 py-1 pl-2 pr-1 text-base leading-tight"
            >
              <span
                className="shrink-0 text-[13px] uppercase leading-none text-muted-foreground"
                aria-hidden
              >
                {id}
              </span>
              {name ? <span className="min-w-0 truncate">{name}</span> : null}
              <button
                type="button"
                className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove ${id} from scene`}
                onClick={() => patchScene(sceneId, { characterIds: characterIds.filter((x) => x !== id) })}
              >
                <X className="size-3.5" strokeWidth={2} aria-hidden />
              </button>
            </span>
          );
        })}
        <select
          key={`scene-char-add-${characterIds.join(",")}`}
          id={`scene-char-add-${sceneId}`}
          className={cn(
            "h-8 w-fit min-w-[10rem] max-w-full flex-none rounded-md border border-dashed border-input bg-transparent px-2 text-base shadow-xs outline-none",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:bg-input/30",
          )}
          disabled={available.length === 0}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v || characterIds.includes(v)) return;
            patchScene(sceneId, { characterIds: [...characterIds, v] });
          }}
        >
          <option value="">
            {kitCharacters.length === 0
              ? "No kit characters"
              : available.length === 0
                ? "All kit characters added"
                : "Add character…"}
          </option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} — {c.name.trim() || "Unnamed"}
            </option>
          ))}
        </select>
      </div>
      {kitCharacters.length === 0 ? (
        <p className="archive-text text-base text-muted-foreground">Add characters in the Characters panel.</p>
      ) : null}
    </div>
  );
}

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
  const kitImageSrcs = normalizeCharacterKitImageSrcs(asset);
  const raw = kitImageSrcs[0] ?? "";
  useEffect(() => {
    setBroken(false);
  }, [raw]);
  /** After a batch finishes, retry load in case a prior attempt 404’d and left `broken` stuck. */
  useEffect(() => {
    if (!isGenerating) setBroken(false);
  }, [isGenerating]);

  const displaySrc = kitAssetDisplaySrc(raw);
  const hasKitImage = kitImageSrcs.length > 0;
  const hasImage = hasKitImage && !broken;
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
          <Popover.Root>
            <Popover.Trigger
              type="button"
              className={kitTileIconBtn}
              disabled={isGenerating}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`Edit ${rowLabel} details`}
            >
              <Pencil className="size-4" strokeWidth={2} aria-hidden />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
                <Popover.Popup
                  className={cn(
                    "max-h-[min(70vh,28rem)] w-[min(calc(100vw-2rem),22rem)] origin-(--transform-origin) overflow-hidden rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none ring-1 ring-foreground/10",
                    "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                  )}
                >
                  <div className="flex max-h-[min(70vh,28rem)] min-h-0 flex-col gap-3 overflow-y-auto">
                    <Popover.Title className="text-xs font-medium uppercase text-muted-foreground">
                      Character
                    </Popover.Title>
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="shrink-0 text-[13px] uppercase leading-none text-muted-foreground"
                        aria-hidden
                      >
                        {asset.id}
                      </span>
                      <label htmlFor={`popover-char-name-${asset.id}`} className="sr-only">
                        Character name
                      </label>
                      <Input
                        id={`popover-char-name-${asset.id}`}
                        className="archive-text min-w-0 flex-1 text-base"
                        placeholder="Name"
                        value={asset.name}
                        onChange={(e) => onPatch(asset.id, { name: e.target.value })}
                        aria-label={`${asset.id}, character name`}
                      />
                    </div>
                    <div className="flex min-h-0 flex-col gap-2">
                      <label
                        htmlFor={`popover-char-desc-${asset.id}`}
                        className="text-xs font-medium uppercase text-muted-foreground"
                      >
                        Prompt
                      </label>
                      <Textarea
                        id={`popover-char-desc-${asset.id}`}
                        className="archive-text min-h-[6rem] flex-1 resize-y text-sm leading-snug"
                        placeholder="Appearance, role, and how they read on screen…"
                        value={asset.description ?? ""}
                        onChange={(e) =>
                          onPatch(asset.id, { description: e.target.value })
                        }
                        rows={6}
                        aria-label={`${asset.id}, character prompt`}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="cursor-pointer"
                        disabled={isGenerating || !hasKitImage}
                        onClick={() =>
                          onPatch(asset.id, {
                            src: undefined,
                            imageSrcs: undefined,
                            width: undefined,
                            height: undefined,
                          })
                        }
                      >
                        Clear image
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="cursor-pointer"
                        disabled={isGenerating}
                        onClick={() => onRemove(asset.id)}
                      >
                        Delete character
                      </Button>
                    </div>
                  </div>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
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
          <ul className="grid list-none grid-cols-4 gap-2 p-0 sm:gap-3">
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
