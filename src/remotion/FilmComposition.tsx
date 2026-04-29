import type { CSSProperties } from "react";
import { AbsoluteFill, Img, Series, interpolate, useCurrentFrame } from "remotion";

import { normalizeHex } from "@/lib/color";
import type { FilmSegmentInput } from "@/lib/renderFilmTimeline";
import type { AssetBundle, Background, KitAsset, TextStyle } from "@/types/styleConfig";

const W = 1920;
const H = 1080;

/** Hero line: centered frame staging copy. */
const FRAME_HERO_PX = 46;
/** Scene title in top-left corner. */
const FRAME_SCENE_CORNER_PX = 32;
/** Asset name next to id tag (bottom bar). */
const FRAME_ASSET_NAME_PX = 28;
/** Id text inside black tags. */
const FRAME_TAG_ID_PX = 22;

const EDGE_PAD = 56;
/** Inset for the scene title in the top-left (tighter than full edge padding). */
const SCENE_TITLE_INSET = 24;

/** Strips a leading "Hook:" beat label from storyboard copy (on-screen only). */
function stripLeadingHookLabel(s: string): string {
  return s.replace(/^\s*Hook\s*:\s*/i, "").trim();
}

function PlateLayer({ background }: { background: Background }) {
  const bgHex = normalizeHex(background.color);
  const bgSrc = background.src?.trim();

  return (
    <>
      <AbsoluteFill style={{ backgroundColor: bgHex, width: W, height: H }} />
      {bgSrc ? (
        <AbsoluteFill style={{ width: W, height: H }}>
          <Img src={bgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      ) : null}
    </>
  );
}

function textStyleForTitle(bundle: AssetBundle): TextStyle {
  return bundle.textStyles[0] ?? {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontWeight: 700,
    color: "#ffffff",
    instructions: "",
  };
}

function textStyleForBody(bundle: AssetBundle): TextStyle {
  if (bundle.textStyles.length > 1) return bundle.textStyles[1]!;
  const t = textStyleForTitle(bundle);
  return { ...t, fontWeight: 400 };
}

function IdTag({
  id,
  fontFamily,
}: {
  id: string;
  fontFamily: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000000",
        color: "#ffffff",
        fontFamily,
        fontSize: FRAME_TAG_ID_PX,
        fontWeight: 600,
        letterSpacing: "normal",
        lineHeight: 1,
        padding: "7px 12px",
        borderRadius: 4,
      }}
    >
      {id}
    </span>
  );
}

function CenteredAssetLine({
  characters,
  assetName,
  fontFamily,
}: {
  characters: KitAsset[];
  assetName: CSSProperties;
  fontFamily: string;
}) {
  const chip = (a: KitAsset) => (
    <span
      key={a.id}
      style={{
        display: "inline-flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minWidth: 0,
      }}
    >
      <IdTag id={a.id} fontFamily={fontFamily} />
      <span style={{ ...assetName, lineHeight: 1.35 }}>{a.name.trim() || "—"}</span>
    </span>
  );

  if (characters.length === 0) {
    return (
      <p style={{ ...assetName, margin: 0, opacity: 0.55 }}>—</p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px 26px",
        maxWidth: 1720,
      }}
    >
      {characters.map((a) => chip(a))}
    </div>
  );
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function wrapDisplayText(text: string, maxChars = 54): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length >= 2) break;
  }
  if (current && lines.length < 3) lines.push(current);
  return lines.length > 0 ? lines : ["—"];
}

function RemotionShapeFrame({ segment }: { segment: FilmSegmentInput }) {
  const frame = useCurrentFrame();
  const { assetBundle, frameDescription, sceneTitle } = segment;
  const titleTs = textStyleForTitle(assetBundle);
  const bodyTs = textStyleForBody(assetBundle);
  const fontFamily = (bodyTs.fontFamily || titleTs.fontFamily) as string;
  const textColor = normalizeHex(bodyTs.color);
  const titleColor = normalizeHex(titleTs.color);
  const seed = hashString(`${segment.sceneId}:${segment.frameId ?? ""}:${frameDescription}`);
  const palette = ["#06b6d4", "#f97316", "#22c55e", "#eab308", "#ef4444", "#8b5cf6"];
  const accentA = palette[seed % palette.length]!;
  const accentB = palette[(seed + 2) % palette.length]!;
  const accentC = palette[(seed + 4) % palette.length]!;
  const drift = interpolate(frame % 90, [0, 45, 90], [-12, 12, -12]);
  const lines = wrapDisplayText(stripLeadingHookLabel(frameDescription), 48);

  return (
    <AbsoluteFill style={{ width: W, height: H }}>
      <PlateLayer background={segment.plate} />
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: 999,
            right: -92 + drift,
            top: 96,
            backgroundColor: normalizeHex(accentA),
            opacity: 0.28,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 560,
            height: 220,
            left: -72,
            bottom: 150 - drift,
            transform: "rotate(-11deg)",
            backgroundColor: normalizeHex(accentB),
            opacity: 0.26,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 240,
            height: 240,
            right: 270,
            bottom: 126 + drift,
            transform: "rotate(18deg)",
            border: `32px solid ${normalizeHex(accentC)}`,
            opacity: 0.42,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          boxSizing: "border-box",
          padding: "72px 88px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <p
          style={{
            margin: 0,
            maxWidth: 760,
            fontFamily,
            fontSize: FRAME_SCENE_CORNER_PX,
            fontWeight: titleTs.fontWeight,
            color: titleColor,
            lineHeight: 1.2,
            letterSpacing: "normal",
          }}
        >
          {stripLeadingHookLabel(sceneTitle) || "—"}
        </p>
        <div style={{ maxWidth: 1320 }}>
          {lines.map((line, i) => (
            <p
              key={`${line}-${i}`}
              style={{
                margin: 0,
                fontFamily,
                fontSize: i === 0 ? 78 : 58,
                fontWeight: i === 0 ? titleTs.fontWeight : bodyTs.fontWeight,
                color: textColor,
                lineHeight: 1.05,
                letterSpacing: "normal",
              }}
            >
              {line}
            </p>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
          }}
        >
          <div style={{ width: 128, height: 12, backgroundColor: normalizeHex(accentA) }} />
          <div style={{ width: 72, height: 12, backgroundColor: normalizeHex(accentB) }} />
          <div style={{ width: 44, height: 12, backgroundColor: normalizeHex(accentC) }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function FilmSegmentContent({ segment }: { segment: FilmSegmentInput }) {
  const { assetBundle, sceneTitle, frameDescription, characters } = segment;
  const still = segment.stillSrc?.trim() ?? "";
  const sceneTitleForDisplay = stripLeadingHookLabel(sceneTitle);
  const frameDescriptionForDisplay = stripLeadingHookLabel(frameDescription);

  /** Generated keyframe: show only the image (no titles, staging copy, or kit overlay). */
  if (still) {
    return (
      <AbsoluteFill style={{ width: W, height: H }}>
        <Img src={still} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    );
  }

  if (segment.frameProductionType === "remotion-shapes") {
    return <RemotionShapeFrame segment={segment} />;
  }

  const titleTs = textStyleForTitle(assetBundle);
  const bodyTs = textStyleForBody(assetBundle);
  const fontFamily = bodyTs.fontFamily as string;

  const body: CSSProperties = {
    margin: 0,
    fontFamily,
    fontSize: FRAME_HERO_PX,
    fontWeight: bodyTs.fontWeight,
    color: bodyTs.color,
    lineHeight: 1.35,
    letterSpacing: "normal",
  };

  const sceneCorner: CSSProperties = {
    margin: 0,
    fontFamily,
    fontSize: FRAME_SCENE_CORNER_PX,
    fontWeight: titleTs.fontWeight,
    color: titleTs.color,
    lineHeight: 1.25,
    letterSpacing: "normal",
    maxWidth: "min(48vw, 640px)",
    whiteSpace: "pre-wrap",
  };

  const assetName: CSSProperties = {
    margin: 0,
    fontFamily,
    fontSize: FRAME_ASSET_NAME_PX,
    fontWeight: bodyTs.fontWeight,
    color: bodyTs.color,
    lineHeight: 1.45,
    letterSpacing: "normal",
  };

  return (
    <AbsoluteFill style={{ width: W, height: H }}>
      <PlateLayer background={segment.plate} />
      <AbsoluteFill
        style={{
          width: W,
          height: H,
          zIndex: 2,
          boxSizing: "border-box",
          padding: EDGE_PAD,
        }}
      >
        <p style={{ ...sceneCorner, position: "absolute", top: SCENE_TITLE_INSET, left: SCENE_TITLE_INSET, zIndex: 1 }}>
          {sceneTitleForDisplay.trim() || "—"}
        </p>

        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              paddingLeft: 48,
              paddingRight: 48,
              paddingTop: 72,
              paddingBottom: 24,
              boxSizing: "border-box",
            }}
          >
            {frameDescriptionForDisplay.trim() ? (
              <p
                style={{
                  ...body,
                  textAlign: "center",
                  maxWidth: 1400,
                  maxHeight: 560,
                  overflow: "hidden",
                  whiteSpace: "pre-wrap",
                }}
              >
                {frameDescriptionForDisplay}
              </p>
            ) : (
              <p style={{ ...body, textAlign: "center", opacity: 0.45 }}>—</p>
            )}
          </div>

          <div
            style={{
              flexShrink: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              paddingLeft: EDGE_PAD,
              paddingRight: EDGE_PAD,
              paddingBottom: 8,
              boxSizing: "border-box",
            }}
          >
            <CenteredAssetLine characters={characters} assetName={assetName} fontFamily={fontFamily} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export type FilmCompositionProps = {
  segments: FilmSegmentInput[];
};

export function FilmComposition({ segments }: FilmCompositionProps) {
  return (
    <Series>
      {segments.map((segment, index) => (
        <Series.Sequence key={index} durationInFrames={segment.durationInFrames}>
          <FilmSegmentContent segment={segment} />
        </Series.Sequence>
      ))}
    </Series>
  );
}
