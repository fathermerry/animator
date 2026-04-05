import type { CSSProperties } from "react";
import { AbsoluteFill, Img, Series } from "remotion";

import { normalizeHex } from "@/lib/color";
import type { FilmSegmentInput } from "@/lib/renderFilmTimeline";
import type { Style, StyleAsset, TextStyle } from "@/types/styleConfig";

const W = 1920;
const H = 1080;

/** Single reading size for all frame copy; hierarchy via weight, color, and layout only. */
const FRAME_BODY_PX = 34;
/** Uppercase section labels (video frame — not app chrome). */
const FRAME_LABEL_PX = 20;
/** Smaller uppercase labels for Characters / Objects blocks. */
const FRAME_CHAR_OBJ_LABEL_PX = 14;
/** Asset name next to id tag (smaller than scene body). */
const FRAME_ASSET_NAME_PX = 20;
/** Id text inside black tags (smaller than body). */
const FRAME_TAG_ID_PX = 16;

function StylePlate({ style }: { style: Style }) {
  const bgHex = normalizeHex(style.background.color);
  const bgSrc = style.background.src?.trim();

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

function textStyleForTitle(style: Style): TextStyle {
  return style.textStyles[0] ?? {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontWeight: 700,
    color: "#ffffff",
    instructions: "",
  };
}

function textStyleForBody(style: Style): TextStyle {
  if (style.textStyles.length > 1) return style.textStyles[1]!;
  const t = textStyleForTitle(style);
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
        padding: "5px 10px",
        borderRadius: 3,
      }}
    >
      {id}
    </span>
  );
}

function AssetTagRow({
  assets,
  assetName,
  emptyLine,
}: {
  assets: StyleAsset[];
  assetName: CSSProperties;
  emptyLine: CSSProperties;
}) {
  if (assets.length === 0) {
    return (
      <p style={{ ...emptyLine, marginTop: 12, whiteSpace: "pre-wrap" }}>—</p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "14px 20px",
        marginTop: 12,
      }}
    >
      {assets.map((a) => (
        <span
          key={a.id}
          style={{
            display: "inline-flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <IdTag id={a.id} fontFamily={assetName.fontFamily as string} />
          <span style={{ ...assetName, lineHeight: 1.35 }}>{a.name.trim() || "—"}</span>
        </span>
      ))}
    </div>
  );
}

function FilmSegmentContent({ segment }: { segment: FilmSegmentInput }) {
  const { style, sceneTitle, sceneDescription, characters, objects } = segment;

  const titleTs = textStyleForTitle(style);
  const bodyTs = textStyleForBody(style);
  const fontFamily = bodyTs.fontFamily;

  const label: CSSProperties = {
    fontFamily,
    fontSize: FRAME_LABEL_PX,
    fontWeight: 600,
    color: "rgba(255,255,255,0.48)",
    letterSpacing: "normal",
    textTransform: "uppercase",
    margin: 0,
  };

  const labelCharObj: CSSProperties = {
    ...label,
    fontSize: FRAME_CHAR_OBJ_LABEL_PX,
  };

  const body: CSSProperties = {
    margin: 0,
    fontFamily,
    fontSize: FRAME_BODY_PX,
    fontWeight: bodyTs.fontWeight,
    color: bodyTs.color,
    lineHeight: 1.45,
    letterSpacing: "normal",
  };

  const titleText: CSSProperties = {
    ...body,
    fontWeight: titleTs.fontWeight,
    color: titleTs.color,
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

  const gapCol = 72;
  const gapBlock = 28;

  return (
    <AbsoluteFill style={{ width: W, height: H }}>
      <StylePlate style={style} />
      <AbsoluteFill
        style={{
          width: W,
          height: H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 420px) minmax(0, 1fr)",
            columnGap: gapCol,
            rowGap: 0,
            alignItems: "stretch",
            width: "100%",
            maxWidth: 1680,
          }}
        >
          {/* Metadata column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: gapBlock,
            }}
          >
            <div>
              <p style={labelCharObj}>Characters</p>
              <AssetTagRow assets={characters} assetName={assetName} emptyLine={assetName} />
            </div>
            <div>
              <p style={labelCharObj}>Objects</p>
              <AssetTagRow assets={objects} assetName={assetName} emptyLine={assetName} />
            </div>
          </div>

          {/* Story column: title as hero line, description as supporting block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 40,
              minWidth: 0,
            }}
          >
            <div>
              <p style={{ ...label, marginBottom: 14 }}>Scene title</p>
              <p style={{ ...titleText, whiteSpace: "pre-wrap" }}>{sceneTitle || "—"}</p>
            </div>
            <div style={{ minHeight: 0 }}>
              <p style={{ ...label, marginBottom: 14 }}>Frame description</p>
              {sceneDescription ? (
                <p
                  style={{
                    ...body,
                    maxHeight: 380,
                    overflow: "hidden",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {sceneDescription}
                </p>
              ) : (
                <p style={body}>—</p>
              )}
            </div>
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
