import { cn } from "@/lib/utils";

type Props = {
  active: "projects" | "renders";
};

export function MainAppNav({ active }: Props) {
  return (
    <nav className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="App">
      <a
        href="#/projects"
        className={cn(
          active === "projects" ? "text-foreground" : "text-muted-foreground transition-colors hover:text-foreground",
          "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Projects
      </a>
      <span className="text-border select-none" aria-hidden>
        /
      </span>
      <a
        href="#/renders"
        className={cn(
          active === "renders" ? "text-foreground" : "text-muted-foreground transition-colors hover:text-foreground",
          "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Cost
      </a>
    </nav>
  );
}
