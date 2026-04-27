import { cn } from "@/lib/utils";
import { pathForProjectStep } from "@/router";

type Props = {
  projectId: string;
  active: "story" | "compose";
};

/**
 * In-app step switcher, matching the Projects / Cost pattern on the home page.
 */
export function WorkflowStepNav({ projectId, active }: Props) {
  const storyHref = `#${pathForProjectStep(projectId, "story")}`;
  const composeHref = `#${pathForProjectStep(projectId, "compose")}`;

  return (
    <nav className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Story and compose">
      <a
        id="nav-workflow-story"
        href={storyHref}
        className={cn(
          active === "story" ? "text-foreground" : "text-muted-foreground transition-colors hover:text-foreground",
          "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Story
      </a>
      <span className="text-border select-none" aria-hidden>
        /
      </span>
      <a
        id="nav-workflow-compose"
        href={composeHref}
        className={cn(
          active === "compose" ? "text-foreground" : "text-muted-foreground transition-colors hover:text-foreground",
          "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Compose
      </a>
    </nav>
  );
}
