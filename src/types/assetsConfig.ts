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
  /** Present for characters only; omit for kit objects. */
  description?: string;
  src?: string;
  width?: number;
  height?: number;
};

/** Visual kit (plate, type, characters, objects). Referenced by `Project.assetsConfigId`. */
export type AssetBundle = {
  id: string;
  name: string;
  background: Background;
  textStyles: TextStyle[];
  characters: KitAsset[];
  objects: KitAsset[];
  notes: string;
};

export type AssetsConfig = {
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

export const defaultObjects: KitAsset[] = [
  { id: "001", name: "House / property" },
  { id: "002", name: "Documents stack" },
  { id: "003", name: "SA302 form" },
  { id: "004", name: "Tax vs borrowing seesaw" },
  { id: "005", name: "Trading timeline" },
  { id: "006", name: "Income scale" },
  { id: "007", name: "Funnel" },
  { id: "008", name: "Credit score meter" },
  { id: "009", name: "Checkmark" },
  { id: "010", name: "Warning triangle" },
];

function cloneDefaultKitAssets(list: KitAsset[]): KitAsset[] {
  return list.map((a) => ({ ...a }));
}

export function createDefaultAssetBundle(): AssetBundle {
  return {
    id: crypto.randomUUID(),
    name: "Default assets",
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
    objects: cloneDefaultKitAssets(defaultObjects),
  };
}

export function createDefaultAssetsConfig(): AssetsConfig {
  return {
    id: crypto.randomUUID(),
    name: "Default assets",
    assets: createDefaultAssetBundle(),
  };
}
