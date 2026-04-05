import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    <div className={cn("flex min-h-0 flex-col gap-6", className)}>
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-medium uppercase text-muted-foreground">Scene</p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="render-scene-title" className="text-sm text-muted-foreground">
              Title
            </Label>
            <Input
              id="render-scene-title"
              value={sceneTitle}
              onChange={(e) => onPatchScene(scene.id, { title: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="render-scene-desc" className="text-sm text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="render-scene-desc"
              value={sceneDesc}
              onChange={(e) => onPatchScene(scene.id, { description: e.target.value })}
              className="min-h-[5rem]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="render-scene-dur" className="text-sm text-muted-foreground">
              Duration (seconds)
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
      </div>

      {frame ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-medium uppercase text-muted-foreground">Frame</p>
          <div className="flex flex-col gap-1">
            <Label htmlFor="render-frame-desc" className="text-sm text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="render-frame-desc"
              value={frameDesc}
              onChange={(e) => onPatchFrame(frame.id, { description: e.target.value })}
              className="min-h-[5rem]"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Frame</p>
          <p className="text-sm text-muted-foreground">
            This segment has no frame row (scene-only). Add frames in your pipeline or edit the scene
            beat above.
          </p>
        </div>
      )}
    </div>
  );
}
