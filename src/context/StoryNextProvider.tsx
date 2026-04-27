import { createContext, useContext, type ReactNode } from "react";

import { useStoryNextActions } from "@/hooks/useStoryNextActions";

type StoryNextContextValue = ReturnType<typeof useStoryNextActions>;

const StoryNextContext = createContext<StoryNextContextValue | null>(null);

export function StoryNextProvider({ children }: { children: ReactNode }) {
  const value = useStoryNextActions();
  return <StoryNextContext.Provider value={value}>{children}</StoryNextContext.Provider>;
}

export function useStoryNextContext(): StoryNextContextValue {
  const ctx = useContext(StoryNextContext);
  if (!ctx) {
    throw new Error("useStoryNextContext must be used within StoryNextProvider");
  }
  return ctx;
}
