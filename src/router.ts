export function getPath(): string {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return path === "" ? "/" : path;
}

export function navigate(path: string): void {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  window.location.hash = normalized;
}

export function onRouteChange(handler: () => void): () => void {
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}
