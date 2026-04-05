import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand/react";

import { StylePreview } from "@/components/StylePreview";
import { WorkflowPreviewColumn } from "@/components/WorkflowPreviewColumn";
import { WorkflowStepLayout } from "@/components/WorkflowStepLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type Props = { step: Step };

type KitKey = "characters" | "objects";

type KitSelection = { kind: KitKey; id: string };

function kitDisplayId(style: Style, kind: KitKey, id: string): string | null {
  const list = style[kind];
  return list.some((a) => a.id === id) ? id : null;
}

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
  /** One editing row across Characters + Objects so two kit rows are never “active” together. */
  const [editingKit, setEditingKit] = useState<KitSelection | null>(null);

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
    setKitSelection((sel) => {
      if (!sel) return null;
      const list = style[sel.kind];
      return list.some((a) => a.id === sel.id) ? sel : null;
    });
    setEditingKit((ek) => {
      if (!ek) return null;
      const list = style[ek.kind];
      return list.some((a) => a.id === ek.id) ? ek : null;
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
    setEditingKit((ek) => (ek?.kind === kind && ek.id === id ? null : ek));
    setKitSelection((sel) => (sel?.kind === kind && sel.id === id ? null : sel));
    updateStyle((s) => {
      const filtered = s[kind].filter((a) => a.id !== id);
      const next =
        kind === "characters" ? normalizeCharacterIds(filtered) : normalizeObjectIds(filtered);
      return { ...s, [kind]: next };
    });
  };

  const toggleKitSelection = (kind: KitKey, id: string) => {
    setEditingKit(null);
    setKitSelection((prev) =>
      prev?.kind === kind && prev.id === id ? null : { kind, id },
    );
  };

  const beginEditKit = (kind: KitKey, id: string) => {
    setKitSelection({ kind, id });
    setEditingKit({ kind, id });
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

  const kitPreviewId =
    kitSelection && kitDisplayId(style, kitSelection.kind, kitSelection.id);

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

  return (
    <WorkflowStepLayout
      primary={
        <div className="flex w-full min-w-0 flex-col gap-8 lg:max-w-sm lg:shrink-0">
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
              editingKit={editingKit}
              onBeginEdit={(id) => beginEditKit("characters", id)}
              onEndEdit={() => setEditingKit(null)}
              onToggleSelect={toggleKitSelection}
              onAddLine={() => addKitPlaceholder("characters")}
              onRemove={(id) => removeKitAsset("characters", id)}
              onPatch={(id, patch) => patchKitAsset("characters", id, patch)}
              onPickImage={(id) => openKitImagePicker("characters", id)}
              showAssetImage={false}
              showRemoveButton={false}
            />

            <KitSection
              kind="objects"
              label="Objects"
              addLabel="Add object"
              emptyMessage="Nothing here yet"
              assets={style.objects}
              selection={kitSelection}
              editingKit={editingKit}
              onBeginEdit={(id) => beginEditKit("objects", id)}
              onEndEdit={() => setEditingKit(null)}
              onToggleSelect={toggleKitSelection}
              onAddLine={() => addKitPlaceholder("objects")}
              onRemove={(id) => removeKitAsset("objects", id)}
              onPatch={(id, patch) => patchKitAsset("objects", id, patch)}
              onPickImage={(id) => openKitImagePicker("objects", id)}
              showAssetImage={false}
              showRemoveButton={false}
            />
          </div>
        </div>
      }
      preview={
        <WorkflowPreviewColumn>
          <StylePreview
            style={style}
            kitSelectionDisplayId={kitPreviewId}
            className="w-full"
          />
        </WorkflowPreviewColumn>
      }
      previewFooter={
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
                onClick={() => {
                  setBackgroundError(null);
                  backgroundFileInputRef.current?.click();
                }}
              >
                {style.background.src?.trim() ? "Replace image" : "Choose image"}
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
      }
    />
  );
}

function AssetThumbButton({ asset, onPick }: { asset: StyleAsset; onPick: () => void }) {
  const [broken, setBroken] = useState(false);
  const raw = asset.src?.trim() ?? "";
  useEffect(() => {
    setBroken(false);
  }, [raw]);

  const hasImage = Boolean(raw) && !broken;
  const src = hasImage ? raw : PLACEHOLDER_PNG;

  return (
    <button
      type="button"
      onClick={onPick}
      title={raw ? "Replace PNG" : "Add PNG"}
      aria-label={raw ? "Replace image" : "Add image"}
      className={cn(
        "relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-sm p-0",
        "bg-muted ring-1 ring-inset ring-border/0 transition-[box-shadow,background-color]",
        "hover:ring-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        hasImage && "bg-primary/10 ring-primary/25",
      )}
    >
      <img
        src={src}
        alt=""
        className={cn("h-full w-full object-contain", !hasImage && "opacity-55")}
        onError={() => {
          if (raw) setBroken(true);
        }}
      />
    </button>
  );
}

function KitSection({
  kind,
  label,
  addLabel,
  emptyMessage,
  showDescriptionRow = false,
  showAssetImage = true,
  showRemoveButton = true,
  assets,
  selection,
  editingKit,
  onBeginEdit,
  onEndEdit,
  onToggleSelect,
  onAddLine,
  onRemove,
  onPatch,
  onPickImage,
}: {
  kind: KitKey;
  label: string;
  addLabel: string;
  emptyMessage: string;
  showDescriptionRow?: boolean;
  showAssetImage?: boolean;
  showRemoveButton?: boolean;
  assets: StyleAsset[];
  selection: KitSelection | null;
  editingKit: KitSelection | null;
  onBeginEdit: (id: string) => void;
  onEndEdit: () => void;
  onToggleSelect: (kind: KitKey, id: string) => void;
  onAddLine: () => void;
  onRemove: (id: string) => void;
  onPatch: (id: string, patch: Partial<StyleAsset>) => void;
  onPickImage: (id: string) => void;
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
          <ul className="flex list-none flex-col gap-2.5 p-0">
            {assets.map((asset, index) => {
              const isSelected = selection?.kind === kind && selection.id === asset.id;
              const rowLabel = `${label} ${index + 1}`;
              const isEditing =
                editingKit?.kind === kind && editingKit.id === asset.id;
              const readOnly = !isEditing;
              return (
                <li key={asset.id} className="group">
                  <Card
                    size="sm"
                    onClick={() => onToggleSelect(kind, asset.id)}
                    className={cn(
                      "cursor-pointer gap-0 rounded-sm py-0 shadow-none transition-[box-shadow]",
                      isSelected ? "ring-1 ring-white" : "ring-1 ring-foreground/10",
                    )}
                  >
                    <CardContent className="flex flex-row items-stretch gap-0 p-0">
                      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                        {readOnly ? (
                          <div className="flex min-h-6 min-w-0 items-stretch">
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 px-1 py-0">
                              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <span
                                  className={cn(
                                    "shrink-0 text-[13px] leading-none text-muted-foreground",
                                    kind === "characters" && "uppercase",
                                  )}
                                >
                                  {asset.id}
                                </span>
                                <span className="min-w-0 truncate text-base leading-tight text-foreground">
                                  {asset.name.trim() ? asset.name : "—"}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="archive-text shrink-0 py-0 text-sm leading-tight text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onBeginEdit(asset.id);
                                }}
                                aria-label={`Edit ${rowLabel}`}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex min-h-6 min-w-0 items-stretch">
                            <span
                              className={cn(
                                "shrink-0 self-center px-1 text-[13px] leading-none text-muted-foreground",
                                kind === "characters" && "uppercase",
                              )}
                              aria-hidden
                            >
                              {asset.id}
                            </span>
                            <label htmlFor={`asset-name-${label}-${asset.id}`} className="sr-only">
                              Name
                            </label>
                            <Input
                              id={`asset-name-${label}-${asset.id}`}
                              className={cn(
                                "archive-text h-6 min-w-0 flex-1 cursor-text rounded-none border-0 bg-transparent px-1 py-0 text-base leading-tight shadow-none",
                                "placeholder:text-muted-foreground/50",
                                "focus-visible:ring-0",
                              )}
                              placeholder="Name"
                              value={asset.name}
                              onChange={(e) => onPatch(asset.id, { name: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`${asset.id}, ${rowLabel} name`}
                            />
                            {isEditing ? (
                              <button
                                type="button"
                                className="archive-text flex min-h-6 shrink-0 items-center justify-center border-l border-border/25 px-1 text-sm leading-tight text-muted-foreground transition-colors hover:bg-muted-foreground/10 hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEndEdit();
                                }}
                                aria-label={`Done editing ${rowLabel}`}
                              >
                                Done
                              </button>
                            ) : showRemoveButton ? (
                              <button
                                type="button"
                                className="archive-text flex min-h-6 w-5 shrink-0 items-center justify-center border-l border-border/25 text-muted-foreground/50 transition-colors hover:bg-muted-foreground/10 hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemove(asset.id);
                                }}
                                aria-label={`Remove ${rowLabel}`}
                                title="Remove"
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        )}
                        {showDescriptionRow ? (
                          <div className="flex min-h-6 min-w-0 items-stretch border-t border-border/25">
                            <label htmlFor={`asset-desc-${label}-${asset.id}`} className="sr-only">
                              Note
                            </label>
                            <Input
                              id={`asset-desc-${label}-${asset.id}`}
                              className={cn(
                                "archive-text h-6 min-w-0 flex-1 cursor-text rounded-none border-0 bg-transparent px-1 py-0 text-base leading-tight shadow-none",
                                "placeholder:text-muted-foreground/50",
                                "focus-visible:ring-0",
                              )}
                              placeholder="Note"
                              value={asset.description ?? ""}
                              onChange={(e) => onPatch(asset.id, { description: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`${rowLabel} note`}
                            />
                          </div>
                        ) : null}
                      </div>

                      {showAssetImage ? (
                        <div
                          className="flex shrink-0 items-center p-px pl-0"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <AssetThumbButton asset={asset} onPick={() => onPickImage(asset.id)} />
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
