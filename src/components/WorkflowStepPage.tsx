import type { ComponentProps } from "react";

import { WorkflowStepLayout } from "@/components/WorkflowStepLayout";
import { cn } from "@/lib/utils";

export type WorkflowStepPageProps = ComponentProps<typeof WorkflowStepLayout>;

/** Same outer shell + main layout for Story, Style, and Compose. */
export function WorkflowStepPage({ className, ...props }: WorkflowStepPageProps) {
  return (
    <WorkflowStepLayout
      className={cn(
        "basis-0 overflow-hidden flex min-h-0 h-full min-w-0 flex-1 flex-col justify-start py-2 md:py-3 lg:h-full lg:min-h-0 lg:flex-1 lg:py-0",
        className,
      )}
      {...props}
    />
  );
}
