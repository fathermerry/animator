import { useStore } from "zustand/react";

import { RenderSceneLayers } from "@/components/RenderSceneLayers";
import { StylePreview } from "@/components/StylePreview";
import { WorkflowPreviewColumn } from "@/components/WorkflowPreviewColumn";
import { WorkflowStepLayout } from "@/components/WorkflowStepLayout";
import { cn } from "@/lib/utils";
import { selectResolvedStyle, useProjectStore } from "@/store/projectStore";
import type { Step } from "@/steps";

type Props = { step: Step };

/** Render step: scene/frame breakdown; style preview matches Story/Style. */
export function RenderPageView({ step: _step }: Props) {
  const style = useStore(useProjectStore, selectResolvedStyle);
  const scenes = useStore(useProjectStore, (s) => s.scenes);
  const frames = useStore(useProjectStore, (s) => s.frames);
  const renders = useStore(useProjectStore, (s) => s.renders);

  return (
    <WorkflowStepLayout
      className="py-2 md:py-3 lg:py-4"
      primaryClassName="pt-0 pl-3 md:px-5 md:pt-0 lg:pl-4 lg:pt-1 lg:pr-6"
      primary={
        <div className="flex w-full min-w-0 flex-col lg:min-h-0 lg:flex-row lg:items-stretch">
          <aside
            className={cn(
              "flex min-h-0 w-full flex-col pb-4 lg:pb-0",
              "lg:sticky lg:top-14 lg:max-h-[calc(100svh-3.5rem)] lg:min-h-0 lg:w-[16rem] lg:shrink-0 lg:pr-4",
            )}
            aria-label="Scene layers"
          >
            <RenderSceneLayers
              variant="sidebar"
              scenes={scenes}
              frames={frames}
              renders={renders}
              className="w-full min-w-0"
            />
          </aside>
          <div className="min-h-0 min-w-0 flex-1" aria-hidden />
        </div>
      }
      preview={
        <WorkflowPreviewColumn>
          <StylePreview style={style} className="w-full shrink-0" />
        </WorkflowPreviewColumn>
      }
    />
  );
}
