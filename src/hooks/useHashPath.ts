import { useLayoutEffect, useState } from "react";

import { getPath } from "@/router";

export function useHashPath(): string {
  const [path, setPath] = useState(getPath);
  useLayoutEffect(() => {
    setPath(getPath());
    const onChange = () => setPath(getPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}
