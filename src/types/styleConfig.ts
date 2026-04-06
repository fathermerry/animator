export type Background = {
  src?: string;
  color: string;
};

export type TextStyle = {
  fontFamily: string;
  fontWeight: number;
  color: string;
  instructions: string;
};

export type KitAsset = {
  id: string;
  name: string;
  /** Characters: appearance / role for prompts. */
  description?: string;
  src?: string;
  /** Characters: up to five reference images; `src` mirrors the first for compatibility. */
  imageSrcs?: string[];
  width?: number;
  height?: number;
};

/** Visual kit: plate, type, characters. Referenced by {@link Project.styleConfigId}. */
export type AssetBundle = {
  id: string;
  name: string;
  /** Overall style direction for the film (tone, palette, constraints). */
  description: string;
  background: Background;
  textStyles: TextStyle[];
  characters: KitAsset[];
  notes: string;
};

/** One named style document: metadata plus the editable kit (`assets`). */
export type StyleConfig = {
  id: string;
  name: string;
  assets: AssetBundle;
};

export const defaultCharacters: KitAsset[] = [
  {
    id: "C01",
    name: "Narrator",
    description:
      "The channel’s central host: direct-to-camera explainer energy like finance YouTube thumbnails—expressive face, simple outfit, the face of the story. He stands in for self-employed viewers learning the rules (charts, walkthroughs, reactions) but reads first as narrator/host, not only as an applicant. Smart-casual, approachable, not a caricature; arc from stressed or overwhelmed to calmer once things make sense.",
  },
  {
    id: "C02",
    name: "Lender",
    description:
      "Represents a bank or building society: professional, neutral, trustworthy. Explains rules in plain language—affordability, deposits, documents—not salesy. Typical props: branded folder, desk, screen with forms. Good for “what the bank needs from you” beats.",
  },
  {
    id: "C03",
    name: "Accountant",
    description:
      "Calm, numbers-first helper: reconciling books, SA302s, tax years, and declared income. Setting can be a small practice, home office, or meeting with the narrator. Laptop, printouts, calculator energy. Use when the story is about proving income from accounts, not just payslips.",
  },
  {
    id: "C04",
    name: "Broker",
    description:
      "Whole-of-market mortgage adviser: consultative, compares options, sits between the client and lenders. Often with a laptop, comparison notes, or a phone call in frame. Use for “shopping the market,” explaining product types, or walking through an application step-by-step.",
  },
  {
    id: "C05",
    name: "Employee",
    description:
      "A salaried PAYE worker for contrast: payslips, P60, simpler proof of income. Same friendly tone as the narrator but fewer moving parts—use in split-screen or before/after comparisons when you need to show how self-employed underwriting differs from standard employment.",
  },
];

function cloneDefaultKitAssets(list: KitAsset[]): KitAsset[] {
  return list.map((a) => ({ ...a }));
}

/**
 * Default copy for `AssetBundle.description` (Style page + frame prompts).
 * Keep in sync with `assets.description` in `src/data/default-project.json`.
 */
export const DEFAULT_STYLE_KIT_DESCRIPTION =
  "UK finance YouTube explainer: 2D illustration with flat colour or soft cel-style shading — clear silhouettes, readable faces, broadcast-friendly contrast. Approachable and direct, not corporate-stiff. " +
  "Not photoreal photography, not glossy stock-ad stills, and not cinematic live-action or documentary office B-roll unless the scene copy explicitly calls for it. " +
  "One clear focal idea per frame; same graphic language as the square style-kit asset thumbnails (characters and props feel like they belong to one channel).";

export function createDefaultAssetBundle(): AssetBundle {
  return {
    id: crypto.randomUUID(),
    name: "Default style",
    description: DEFAULT_STYLE_KIT_DESCRIPTION,
    notes: "",
    background: { color: "#0a0a0a" },
    textStyles: [
      {
        fontFamily: "Arial, Helvetica, sans-serif",
        fontWeight: 700,
        color: "#ffffff",
        instructions: "Title — short, high impact",
      },
      {
        fontFamily: "Arial, Helvetica, sans-serif",
        fontWeight: 400,
        color: "#a3a3a3",
        instructions: "Supporting line — subtext or CTA",
      },
    ],
    characters: cloneDefaultKitAssets(defaultCharacters),
  };
}

export function createDefaultStyleConfig(): StyleConfig {
  return {
    id: crypto.randomUUID(),
    name: "Default style",
    assets: createDefaultAssetBundle(),
  };
}
