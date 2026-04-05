import { useEffect } from "react";
import { useStore } from "zustand/react";

import { StylePreview } from "@/components/StylePreview";
import { WorkflowPreviewColumn } from "@/components/WorkflowPreviewColumn";
import { WorkflowStepLayout } from "@/components/WorkflowStepLayout";
import { cn } from "@/lib/utils";
import { selectCurrentProject, selectResolvedStyle, useProjectStore } from "@/store/projectStore";
import type { Step } from "@/steps";

type Props = { step: Step };

export function ScriptPageView({ step: _step }: Props) {
  const project = useStore(useProjectStore, selectCurrentProject);
  const style = useStore(useProjectStore, selectResolvedStyle);
  const ensureDraft = useStore(useProjectStore, (s) => s.ensureDraftProject);
  const setPromptText = useStore(useProjectStore, (s) => s.setPromptText);

  useEffect(() => {
    ensureDraft();
  }, [ensureDraft]);

  const text = project?.prompt ?? "";

  return (
    <WorkflowStepLayout
      primary={
        <div className="w-full max-w-[min(100%,42rem)] pt-2">
          <textarea
            value={text}
            onChange={(e) => setPromptText(e.target.value)}
            autoComplete="off"
            spellCheck
            placeholder="Start typing"
            className={cn(
              "min-h-[min(28rem,55svh)] w-full min-w-0 flex-1 resize-none bg-transparent",
              "[field-sizing:content]",
              "border-0 p-0 text-left shadow-none outline-none ring-0",
              "focus-visible:ring-0",
              "placeholder:text-muted-foreground/35",
              "leading-relaxed text-foreground",
              /* Soft fade at top and bottom (not sides) */
              "[mask-image:linear-gradient(to_bottom,transparent,black_1.125rem,black_calc(100%-1.125rem),transparent)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_1.125rem,black_calc(100%-1.125rem),transparent)] [mask-size:100%_100%] [-webkit-mask-size:100%_100%]",
            )}
            aria-label="Prompt"
          />
        </div>
      }
      preview={
        <WorkflowPreviewColumn>
          <StylePreview style={style} className="w-full" />
        </WorkflowPreviewColumn>
      }
    />
  );
}
