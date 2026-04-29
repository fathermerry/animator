export async function jsonApiHeaders(): Promise<Record<string, string>> {
  return { "Content-Type": "application/json" };
}
