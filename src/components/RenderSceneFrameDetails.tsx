import { useState } from "react";
import { Info } from "lucide-react";
import { useStore } from "zustand/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  findRender,
  frameHasOutputImage,
  isFrameGeneratedForPreview,
} from "@/lib/frameRenderStatus";
import {
  DEFAULT_OPENAI_IMAGE_MODEL,
  OPENAI_IMAGE_MODEL_OPTIONS,
  type OpenAiImageModelId,
  isOpenAiImageModelId,
} from "@/lib/imageModels";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/store/projectStore";
import type { Frame, Render, Scene } from "@/types/project";

function formatCost(amount: number, currency: string): string {
  const cur = currency.trim() || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${cur}`;
  }
}

function formatEngine(engine: Render["engine"]): string {
  if (engine === "openai-image") return "OpenAI image";
  if (engine === "three") return "Three";
  return "Remotion";
}

function modelDisplayLabel(modelId: string | undefined): string {
  if (!modelId?.trim()) return "—";
  const o = OPENAI_IMAGE_MODEL_OPTIONS.find((x) => x.id === modelId);
  return o?.label ?? modelId;
}

type Props = {
  scene: Scene | null;
  frame: Frame | null;
  onPatchScene: (sceneId: string, patch: Partial<Scene>) => void;
  onPatchFrame: (frameId: string, patch: Partial<Frame>) => void;
  className?: string;
};

export function RenderSceneFrameDetails({
  scene,
  frame,
  onPatchScene,
  onPatchFrame,
  className,
}: Props) {
  const renders = useStore(useProjectStore, (s) => s.renders);
  const renderingFrameIds = useStore(useProjectStore, (s) => s.renderingFrameIds);
  const frameRenderErrors = useStore(useProjectStore, (s) => s.frameRenderErrors);
  const requestFrameRender = useStore(useProjectStore, (s) => s.requestFrameRender);
  const cancelFrameRender = useStore(useProjectStore, (s) => s.cancelFrameRender);

  const [imageModel, setImageModel] = useState<OpenAiImageModelId>(DEFAULT_OPENAI_IMAGE_MODEL);
  const [renderDetailsOpen, setRenderDetailsOpen] = useState(false);

  if (!scene) {
    return (
      <div className={cn("flex min-h-0 flex-col gap-3", className)}>
        <p className="text-sm text-muted-foreground">
          No scene at the playhead. Add scenes or move the playhead in the preview.
        </p>
      </div>
    );
  }

  const sceneTitle = scene.title ?? "";
  const sceneDesc = scene.description ?? "";
  const frameDesc = frame?.description ?? "";

  const activeRender = frame ? findRender(renders, frame) : undefined;
  const showRenderDetails =
    frame != null && isFrameGeneratedForPreview(frame, renders);

  return (
    <div className={cn("flex min-h-0 flex-col gap-6", className)}>
      <div className="flex flex-col gap-5">
        <p className="text-xs font-medium uppercase text-muted-foreground">Prompts</p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="render-scene-title" className="text-sm text-muted-foreground">
            Scene title
          </Label>
          <Input
            id="render-scene-title"
            value={sceneTitle}
            onChange={(e) => onPatchScene(scene.id, { title: e.target.value })}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="render-scene-desc" className="text-sm text-muted-foreground">
            Scene description
          </Label>
          <Textarea
            id="render-scene-desc"
            value={sceneDesc}
            onChange={(e) => onPatchScene(scene.id, { description: e.target.value })}
            className="min-h-[5rem]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="render-frame-desc" className="text-sm text-muted-foreground">
            Frame description
          </Label>
          {frame ? (
            <Textarea
              id="render-frame-desc"
              value={frameDesc}
              onChange={(e) => onPatchFrame(frame.id, { description: e.target.value })}
              className="min-h-[5rem]"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              This segment has no frame row (scene-only). Add frames in your pipeline or edit the
              scene beat above.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="render-scene-dur" className="text-sm text-muted-foreground">
            Duration
          </Label>
          <Input
            id="render-scene-dur"
            type="number"
            min={0}
            step={0.1}
            value={Number.isFinite(scene.durationSeconds) ? scene.durationSeconds : 0}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onPatchScene(scene.id, {
                durationSeconds: Number.isFinite(v) ? Math.max(0, v) : 0,
              });
            }}
          />
        </div>
      </div>

      {frame ? (
        <div className="flex flex-col gap-3 self-start">
          <div className="flex flex-col gap-2">
            <Label htmlFor="render-image-model" className="text-sm text-muted-foreground">
              Image model
            </Label>
            <select
              id="render-image-model"
              value={imageModel}
              disabled={Boolean(renderingFrameIds[frame.id])}
              onChange={(e) => {
                const v = e.target.value;
                setImageModel(isOpenAiImageModelId(v) ? v : DEFAULT_OPENAI_IMAGE_MODEL);
              }}
              className={cn(
                "flex h-8 w-full min-w-[12rem] rounded-md border border-input bg-transparent px-2 text-base shadow-xs outline-none",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "dark:bg-input/30",
              )}
            >
              {OPENAI_IMAGE_MODEL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={
                  frameHasOutputImage(frame.src) || Boolean(renderingFrameIds[frame.id])
                }
                onClick={() => void requestFrameRender(frame.id, imageModel)}
              >
                Render
              </Button>
              {renderingFrameIds[frame.id] ? (
                <button
                  type="button"
                  className="rounded-md px-1.5 py-0.5 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => cancelFrameRender(frame.id)}
                >
                  Cancel
                </button>
              ) : null}
            </div>
            {showRenderDetails && activeRender ? (
              <div
                className="inline-flex flex-col-reverse items-end gap-1"
                onMouseEnter={() => setRenderDetailsOpen(true)}
                onMouseLeave={() => setRenderDetailsOpen(false)}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Render details"
                  aria-expanded={renderDetailsOpen}
                >
                  <Info className="size-4" />
                </Button>
                {renderDetailsOpen ? (
                  <div
                    className="mb-1 w-72 max-w-[min(18rem,calc(100vw-3rem))] rounded-md border border-border bg-popover p-3 text-base text-popover-foreground shadow-md"
                    role="tooltip"
                  >
                    <dl className="flex flex-col gap-3">
                      <div>
                        <dt className="text-sm text-muted-foreground">Model</dt>
                        <dd className="text-base text-foreground">
                          {modelDisplayLabel(activeRender.model)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">Engine</dt>
                        <dd className="text-base text-foreground">{formatEngine(activeRender.engine)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">Cost</dt>
                        <dd className="text-base text-foreground">
                          {formatCost(activeRender.cost.amount, activeRender.cost.currency)}
                        </dd>
                      </div>
                      {activeRender.cost.breakdown.length > 0 ? (
                        <div>
                          <dt className="text-sm text-muted-foreground">Breakdown</dt>
                          <dd>
                            <ul className="mt-1 flex list-none flex-col gap-1.5 text-base text-foreground">
                              {activeRender.cost.breakdown.map((item, i) => (
                                <li key={`${item.label}-${i}`}>
                                  <span className="text-muted-foreground">{item.label}</span>
                                  {" — "}
                                  {formatCost(item.amount, activeRender.cost.currency)}
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="text-sm text-muted-foreground">Rendered</dt>
                        <dd className="text-base text-foreground">
                          {activeRender.createdAt instanceof Date
                            ? activeRender.createdAt.toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {frameRenderErrors[frame.id] ? (
            <p className="max-w-full text-sm text-destructive" role="alert">
              {frameRenderErrors[frame.id]}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
