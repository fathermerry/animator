import { renumberKitAssetsWithMaps } from "./kitAssetId";
import { normalizeProjectConfigSeed } from "./projectConfig";
import type { Cost, CostItem, Frame, Project, Render, Scene } from "../types/project";
import {
  createDefaultAssetBundle,
  createDefaultAssetsConfig,
  type AssetBundle,
  type AssetsConfig,
  type Background,
  type KitAsset,
  type TextStyle,
} from "../types/assetsConfig";

export type HydratedProjectBundle = {
  project: Project;
  assetsConfigs: AssetsConfig[];
  scenes: Scene[];
  renders: Render[];
  frames: Frame[];
};

function reviveDate(raw: unknown): Date {
  if (raw instanceof Date) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function reviveTextStyle(raw: unknown, fallback: TextStyle): TextStyle {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const t = raw as Partial<TextStyle>;
  return {
    fontFamily: typeof t.fontFamily === "string" && t.fontFamily.trim() ? t.fontFamily : fallback.fontFamily,
    fontWeight: typeof t.fontWeight === "number" && Number.isFinite(t.fontWeight) ? t.fontWeight : fallback.fontWeight,
    color: typeof t.color === "string" ? t.color : fallback.color,
    instructions: typeof t.instructions === "string" ? t.instructions : fallback.instructions,
  };
}

function reviveCharacterAsset(raw: unknown): KitAsset | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<KitAsset>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) return null;
  const name = typeof o.name === "string" ? o.name : "";
  const description = typeof o.description === "string" ? o.description : "";
  const srcRaw = typeof o.src === "string" ? o.src.trim() : "";
  const src = srcRaw.length > 0 ? srcRaw : undefined;
  const width = typeof o.width === "number" && Number.isFinite(o.width) ? o.width : undefined;
  const height = typeof o.height === "number" && Number.isFinite(o.height) ? o.height : undefined;
  return {
    id,
    name,
    description,
    ...(src ? { src } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
}

/** Kit objects do not carry `description`; legacy keys in JSON are ignored. */
function reviveObjectAsset(raw: unknown): KitAsset | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<KitAsset>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) return null;
  const name = typeof o.name === "string" ? o.name : "";
  const srcRaw = typeof o.src === "string" ? o.src.trim() : "";
  const src = srcRaw.length > 0 ? srcRaw : undefined;
  const width = typeof o.width === "number" && Number.isFinite(o.width) ? o.width : undefined;
  const height = typeof o.height === "number" && Number.isFinite(o.height) ? o.height : undefined;
  return {
    id,
    name,
    ...(src ? { src } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
}

function reviveCharacterAssets(raw: unknown): KitAsset[] {
  if (!Array.isArray(raw)) return [];
  const list = raw.map(reviveCharacterAsset).filter((x): x is KitAsset => x !== null);
  const seen = new Set<string>();
  const out: KitAsset[] = [];
  for (const a of list) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

function reviveObjectAssets(raw: unknown): KitAsset[] {
  if (!Array.isArray(raw)) return [];
  const list = raw.map(reviveObjectAsset).filter((x): x is KitAsset => x !== null);
  const seen = new Set<string>();
  const out: KitAsset[] = [];
  for (const a of list) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

function reviveBackground(raw: unknown, fallback: Background): Background {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const bg = raw as Partial<Background>;
  const color = typeof bg.color === "string" && bg.color.trim() ? bg.color : fallback.color;
  const srcRaw = typeof bg.src === "string" ? bg.src.trim() : "";
  const src = srcRaw.length > 0 ? srcRaw : undefined;
  return { color, ...(src ? { src } : {}) };
}

function reviveAssetBundle(raw: unknown): AssetBundle {
  const d = createDefaultAssetBundle();
  if (!raw || typeof raw !== "object") {
    return { ...d, id: crypto.randomUUID() };
  }
  const s = raw as Partial<AssetBundle>;
  const bg = reviveBackground(s.background, d.background);
  const characters = reviveCharacterAssets(s.characters);
  const objects = reviveObjectAssets(s.objects);
  const textStyles =
    Array.isArray(s.textStyles) && s.textStyles.length > 0
      ? s.textStyles.map((t, i) => reviveTextStyle(t, d.textStyles[i] ?? d.textStyles[0]!))
      : d.textStyles;
  return {
    id: typeof s.id === "string" && s.id.trim() ? s.id : crypto.randomUUID(),
    name: typeof s.name === "string" ? s.name : d.name,
    notes: typeof s.notes === "string" ? s.notes : d.notes,
    background: bg,
    textStyles,
    characters: characters.length > 0 ? characters : [...d.characters],
    objects: objects.length > 0 ? objects : [...d.objects],
  };
}

function reviveAssetsConfig(raw: unknown): AssetsConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<AssetsConfig> & { style?: unknown };
  const bundleRaw = s.assets ?? s.style;
  const assets = reviveAssetBundle(bundleRaw ?? {});
  return {
    id: typeof s.id === "string" && s.id.trim() ? s.id : crypto.randomUUID(),
    name: typeof s.name === "string" ? s.name : "Assets",
    assets,
  };
}

function reviveCostItem(raw: unknown): CostItem | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Partial<CostItem>;
  if (typeof x.label !== "string" || typeof x.amount !== "number" || !Number.isFinite(x.amount)) return null;
  return { label: x.label, amount: x.amount };
}

function reviveCost(raw: unknown): Cost {
  if (!raw || typeof raw !== "object") {
    return { amount: 0, currency: "USD", breakdown: [] };
  }
  const c = raw as Partial<Cost>;
  const breakdownRaw = Array.isArray(c.breakdown) ? c.breakdown : [];
  const breakdown = breakdownRaw.map(reviveCostItem).filter((x): x is CostItem => x !== null);
  return {
    amount: typeof c.amount === "number" && Number.isFinite(c.amount) ? c.amount : 0,
    currency: typeof c.currency === "string" && c.currency.trim() ? c.currency : "USD",
    breakdown,
  };
}

function reviveRender(raw: unknown): Render | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Render>;
  if (typeof r.id !== "string" || !r.id.trim()) return null;
  if (typeof r.projectId !== "string" || !r.projectId.trim()) return null;
  if (typeof r.sceneId !== "string" || !r.sceneId.trim()) return null;
  const engine = r.engine === "three" ? "three" : "remotion";
  const status =
    r.status === "processing" || r.status === "complete" || r.status === "failed" ? r.status : "pending";
  return {
    id: r.id,
    projectId: r.projectId,
    sceneId: r.sceneId,
    engine,
    status,
    cost: reviveCost(r.cost),
    createdAt: reviveDate(r.createdAt),
  };
}

function reviveFrame(raw: unknown): Frame | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Partial<Frame>;
  if (typeof f.id !== "string" || !f.id.trim()) return null;
  if (typeof f.projectId !== "string" || !f.projectId.trim()) return null;
  if (typeof f.sceneId !== "string" || !f.sceneId.trim()) return null;
  if (typeof f.renderId !== "string" || !f.renderId.trim()) return null;
  const index = typeof f.index === "number" && Number.isFinite(f.index) ? Math.max(0, Math.floor(f.index)) : 0;
  const src = typeof f.src === "string" ? f.src : "";
  const description = typeof f.description === "string" ? f.description : "";
  return {
    id: f.id,
    projectId: f.projectId,
    sceneId: f.sceneId,
    renderId: f.renderId,
    index,
    src,
    description,
  };
}

function titleFromLegacyAction(legacyAction: string): string {
  const t = legacyAction.trim();
  if (!t) return "";
  const firstLine = t.split(/\n/)[0]!.trim();
  if (firstLine.length <= 80) return firstLine;
  return `${firstLine.slice(0, 77)}…`;
}

function reviveScene(raw: unknown, projectId: string): Scene | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<Scene> & Record<string, unknown>;
  if (typeof s.id !== "string" || !s.id.trim()) return null;
  const index = typeof s.index === "number" && Number.isFinite(s.index) ? Math.max(0, Math.floor(s.index)) : 0;
  const legacyAction = typeof s.action === "string" ? s.action : "";
  let title = typeof s.title === "string" ? s.title.trim() : "";
  let description = typeof s.description === "string" ? s.description.trim() : "";
  if (!title && legacyAction) {
    title = titleFromLegacyAction(legacyAction);
  }
  if (!description && legacyAction) {
    description = legacyAction.trim();
  }
  const durationSeconds =
    typeof s.durationSeconds === "number" && Number.isFinite(s.durationSeconds) && s.durationSeconds >= 0
      ? s.durationSeconds
      : 0;
  const characterIds = Array.isArray(s.characterIds)
    ? s.characterIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  const objectIds = Array.isArray(s.objectIds)
    ? s.objectIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  return {
    id: s.id,
    projectId: typeof s.projectId === "string" && s.projectId.trim() ? s.projectId : projectId,
    index,
    title,
    description,
    characterIds,
    objectIds,
    durationSeconds,
    createdAt: reviveDate(s.createdAt),
  };
}

function dedupeAssetsConfigs(configs: AssetsConfig[]): AssetsConfig[] {
  const byId = new Map<string, AssetsConfig>();
  for (const c of configs) {
    if (!byId.has(c.id)) byId.set(c.id, c);
  }
  return [...byId.values()];
}

/** Hydrates from parsed JSON. Pass `extraAssetsConfigs` for file-split defaults (e.g. bundled assets JSON). */
export function projectFromConfigJson(raw: unknown, extraAssetsConfigs: AssetsConfig[] = []): HydratedProjectBundle {
  const seed = normalizeProjectConfigSeed(raw);
  const o = seed;
  const projectId = typeof o.id === "string" && o.id.trim() ? o.id : crypto.randomUUID();

  const fromFile = Array.isArray(o.assetsConfigs)
    ? o.assetsConfigs.map(reviveAssetsConfig).filter((x): x is AssetsConfig => x !== null)
    : [];
  const extra = extraAssetsConfigs.map(reviveAssetsConfig).filter((x): x is AssetsConfig => x !== null);
  let assetsConfigs = dedupeAssetsConfigs([...extra, ...fromFile]);

  if (assetsConfigs.length === 0) {
    const fallback = createDefaultAssetsConfig();
    assetsConfigs = [fallback];
  }

  const renumbered = assetsConfigs.map((c) => {
    const r = renumberKitAssetsWithMaps(c.assets);
    return { config: { ...c, assets: r.assets }, maps: r };
  });
  assetsConfigs = renumbered.map((x) => x.config);

  let assetsConfigId = typeof o.assetsConfigId === "string" ? o.assetsConfigId.trim() : "";
  if (!assetsConfigId || !assetsConfigs.some((c) => c.id === assetsConfigId)) {
    assetsConfigId = assetsConfigs[0]!.id;
  }

  const activeRenumber = renumbered.find((x) => x.config.id === assetsConfigId) ?? renumbered[0]!;
  const { characterIdMap, objectIdMap } = activeRenumber.maps;

  const scenesRaw = Array.isArray(o.scenes) ? o.scenes : [];
  let scenes = scenesRaw
    .map((s) => reviveScene(s, projectId))
    .filter((x): x is Scene => x !== null);
  scenes = scenes.map((s) => ({
    ...s,
    characterIds: s.characterIds.map((id) => characterIdMap.get(id) ?? id),
    objectIds: s.objectIds.map((id) => objectIdMap.get(id) ?? id),
  }));

  const rendersRaw = Array.isArray(o.renders) ? o.renders : [];
  const renders = rendersRaw.map(reviveRender).filter((x): x is Render => x !== null);

  const framesRaw = Array.isArray(o.frames) ? o.frames : [];
  const frames = framesRaw.map(reviveFrame).filter((x): x is Frame => x !== null);

  const fileLabelRaw = o.fileLabel;
  const fileLabel =
    typeof fileLabelRaw === "string" && fileLabelRaw.trim() ? fileLabelRaw.trim() : undefined;

  const project: Project = {
    id: projectId,
    name: typeof o.name === "string" ? o.name : "Untitled",
    createdAt: reviveDate(o.createdAt),
    prompt: typeof o.prompt === "string" ? o.prompt : "",
    assetsConfigId,
    ...(fileLabel ? { fileLabel } : {}),
  };

  return { project, assetsConfigs, scenes, renders, frames };
}
