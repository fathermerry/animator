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

export type StyleAsset = {
  id: string;
  name: string;
  /** Present for characters only; omit for style kit objects. */
  description?: string;
  src?: string;
  width?: number;
  height?: number;
};

/** Visual kit: lives in a style config file, referenced by `Project.styleConfigId`. */
export type Style = {
  id: string;
  name: string;
  background: Background;
  textStyles: TextStyle[];
  characters: StyleAsset[];
  objects: StyleAsset[];
  notes: string;
};

export type StyleConfig = {
  id: string;
  name: string;
  style: Style;
};

export const defaultCharacters: StyleAsset[] = [
  {
    id: "C01",
    name: "Protagonist — self-employed borrower (viewer stand-in): smart-casual, relatable arc from stress to clarity",
    description: "",
  },
  {
    id: "C02",
    name: "Bank / lender professional — trustworthy, neutral, explains requirements and paperwork",
    description: "",
  },
  { id: "C03", name: "Accountant — calm, numbers-focused; papers, laptop, or tax office setting", description: "" },
  {
    id: "C04",
    name: "Mortgage broker — whole-of-market guide; consultative, often with docs or screen",
    description: "",
  },
  {
    id: "C05",
    name: "PAYE employee — contrast character; simpler income proof / payslip energy for comparisons",
    description: "",
  },
];

export const defaultObjects: StyleAsset[] = [
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

function cloneDefaultAssets(list: StyleAsset[]): StyleAsset[] {
  return list.map((a) => ({ ...a }));
}

export function createDefaultStyle(): Style {
  return {
    id: crypto.randomUUID(),
    name: "Default style",
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
    characters: cloneDefaultAssets(defaultCharacters),
    objects: cloneDefaultAssets(defaultObjects),
  };
}

export function createDefaultStyleConfig(): StyleConfig {
  return {
    id: crypto.randomUUID(),
    name: "Default style",
    style: createDefaultStyle(),
  };
}
