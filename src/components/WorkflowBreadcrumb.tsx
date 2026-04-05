import { STEPS } from "@/steps";
import { cn } from "@/lib/utils";

type Props = {
  currentSlug: string | null;
};

export function WorkflowBreadcrumb({ currentSlug }: Props) {
  return (
    <nav className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Workflow">
      {STEPS.map((step, i) => (
        <span key={step.slug} className="flex items-center gap-2">
          {i > 0 ? <span className="text-border select-none">/</span> : null}
          {currentSlug === step.slug ? (
            <span className="text-foreground">{step.label}</span>
          ) : (
            <a
              href={`#/${step.slug}`}
              className={cn(
                "text-muted-foreground transition-colors hover:text-foreground",
                "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {step.label}
            </a>
          )}
        </span>
      ))}
    </nav>
  );
}
