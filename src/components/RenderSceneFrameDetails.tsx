import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNarrationAudioDuration } from "@/lib/useNarrationAudioDuration";
import { panelHeadingClass } from "@/lib/panelHeading";
import { cn } from "@/lib/utils";
import type { Frame, Scene } from "@/types/project";

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
  const narrationSrc = scene?.narrationAudioSrc?.trim() ?? "";
  const narrationAudioDur = useNarrationAudioDuration(narrationSrc || undefined);
  const onPatchSceneRef = useRef(onPatchScene);
  onPatchSceneRef.current = onPatchScene;

  useEffect(() => {
    if (!scene) return;
    if (!narrationSrc || narrationAudioDur == null || !Number.isFinite(narrationAudioDur) || narrationAudioDur <= 0) {
      return;
    }
    const next = Math.ceil(narrationAudioDur);
    if (scene.durationSeconds === next) return;
    onPatchSceneRef.current(scene.id, { durationSeconds: next });
  }, [scene, narrationSrc, narrationAudioDur]);

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

  return (
    <div className={cn("flex min-h-0 flex-col gap-4", className)}>
      <div className="flex flex-col gap-4">
        <p className={panelHeadingClass}>Prompts</p>

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
            disabled={Boolean(narrationSrc)}
            value={Number.isFinite(scene.durationSeconds) ? scene.durationSeconds : 0}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onPatchScene(scene.id, {
                durationSeconds: Number.isFinite(v) ? Math.max(0, v) : 0,
              });
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="render-scene-delay" className="text-sm text-muted-foreground">
              Delay
            </Label>
            <Input
              id="render-scene-delay"
              type="number"
              min={0}
              step={0.1}
              value={Number.isFinite(scene.delaySeconds) ? scene.delaySeconds ?? 0 : 0}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onPatchScene(scene.id, {
                  delaySeconds: Number.isFinite(v) && v > 0 ? v : undefined,
                });
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="render-scene-transition" className="text-sm text-muted-foreground">
              Transition
            </Label>
            <select
              id="render-scene-transition"
              value={scene.transition ?? "cut"}
              onChange={(e) =>
                onPatchScene(scene.id, {
                  transition: e.target.value as Scene["transition"],
                })
              }
              className={cn(
                "h-9 rounded-lg border border-input bg-transparent px-2.5 text-base shadow-xs outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
              )}
            >
              <option value="cut">Cut</option>
              <option value="fade">Fade</option>
              <option value="dissolve">Dissolve</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="render-scene-transition-dur" className="text-sm text-muted-foreground">
              Transition sec
            </Label>
            <Input
              id="render-scene-transition-dur"
              type="number"
              min={0}
              step={0.1}
              value={Number.isFinite(scene.transitionSeconds) ? scene.transitionSeconds ?? 0 : 0}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onPatchScene(scene.id, {
                  transitionSeconds: Number.isFinite(v) && v > 0 ? v : undefined,
                });
              }}
            />
          </div>
        </div>

        {frame ? (
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="render-frame-duration" className="text-sm text-muted-foreground">
                Frame hold
              </Label>
              <Input
                id="render-frame-duration"
                type="number"
                min={0}
                step={0.1}
                value={Number.isFinite(frame.durationSeconds) ? frame.durationSeconds ?? 0 : 0}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onPatchFrame(frame.id, {
                    durationSeconds: Number.isFinite(v) && v > 0 ? v : undefined,
                  });
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="render-frame-kind" className="text-sm text-muted-foreground">
                Frame type
              </Label>
              <select
                id="render-frame-kind"
                value={frame.kind ?? "keyframe"}
                onChange={(e) =>
                  onPatchFrame(frame.id, {
                    kind: e.target.value as Frame["kind"],
                  })
                }
                className={cn(
                  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-base shadow-xs outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
                )}
              >
                <option value="keyframe">Keyframe</option>
                <option value="transition">Transition frame</option>
              </select>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
