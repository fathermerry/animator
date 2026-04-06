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
      </div>
    </div>
  );
}
