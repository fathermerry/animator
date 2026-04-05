import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { navigate } from "@/router";
import { FLOW_MAX, getFlowIndex, pathForFlowIndex } from "@/steps";

type Props = {
  path: string;
};

export function WorkflowStepArrows({ path }: Props) {
  let idx = getFlowIndex(path);
  if (idx < 0) idx = 0;

  /** No step before prompt; home (`/`) only redirects into the flow. */
  const canPrev = idx > 1;
  const canNext = idx < FLOW_MAX;

  return (
    <div
      className="flex shrink-0 items-center gap-1"
      role="group"
      aria-label="Navigate workflow steps"
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={!canPrev}
        aria-label="Previous step"
        onClick={() => navigate(pathForFlowIndex(idx - 1))}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={!canNext}
        aria-label="Next step"
        onClick={() => navigate(pathForFlowIndex(idx + 1))}
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
