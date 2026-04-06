import { OPENAI_IMAGE_MODEL_OPTIONS } from "@/lib/imageModels";
import type { Cost, Render } from "@/types/project";

/** Seed/bundled scene shell rows — not OpenAI generations; omit from activity and cross-project lists. */
export function isStructuralFrameShellRender(r: Render): boolean {
  return r.type === "frame" && r.engine === "remotion";
}

function sumCostBreakdown(cost: Cost): number {
  return cost.breakdown.reduce(
    (acc, item) => acc + (Number.isFinite(item.amount) ? item.amount : 0),
    0,
  );
}

/** Prefer `amount` when positive; otherwise sum breakdown lines (same persisted model as API/store). */
export function renderCostTotalAmount(cost: Cost): number {
  const direct = Number.isFinite(cost.amount) ? cost.amount : 0;
  if (direct > 0) return direct;
  const fromBreakdown = sumCostBreakdown(cost);
  return fromBreakdown > 0 ? fromBreakdown : direct;
}

export function sumRenderCosts(renders: readonly { cost: Cost }[]): number {
  return renders.reduce((acc, r) => acc + renderCostTotalAmount(r.cost), 0);
}

export function formatCost(amount: number, currency: string): string {
  const cur = currency.trim() || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${cur}`;
  }
}

export function formatEngine(engine: Render["engine"]): string {
  if (engine === "openai-image") return "OpenAI image";
  if (engine === "three") return "Three";
  return "Remotion";
}

export function formatRenderStatus(status: Render["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function modelDisplayLabel(modelId: string | undefined): string {
  if (!modelId?.trim()) return "—";
  const o = OPENAI_IMAGE_MODEL_OPTIONS.find((x) => x.id === modelId);
  return o?.label ?? modelId;
}

/** Compact timestamp for render lists (floating dock, tables). */
export function formatRenderListTimestamp(createdAt: Date): string {
  return createdAt.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
