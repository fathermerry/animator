import type { CSSProperties } from "react";
import { AbsoluteFill, Img, Series } from "remotion";

import { normalizeHex } from "@/lib/color";
import type { FilmSegmentInput } from "@/lib/renderFilmTimeline";
import type { AssetBundle, KitAsset, TextStyle } from "@/types/styleConfig";

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

function AssetBundlePlate({ bundle }: { bundle: AssetBundle }) {
  const bgHex = normalizeHex(bundle.background.color);
  const bgSrc = bundle.background.src?.trim();

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
  objects,
  assetName,
  fontFamily,
}: {
  characters: KitAsset[];
  objects: KitAsset[];
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

  const hasC = characters.length > 0;
  const hasO = objects.length > 0;
  if (!hasC && !hasO) {
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
      {hasC && hasO ? (
        <span
          aria-hidden
          style={{
            fontFamily,
            fontSize: FRAME_ASSET_NAME_PX,
            color: "rgba(255,255,255,0.35)",
            lineHeight: 1,
            padding: "0 4px",
          }}
        >
          ·
        </span>
      ) : null}
      {objects.map((a) => chip(a))}
    </div>
  );
}

function GeneratedStillBackdrop({ src }: { src: string }) {
  return (
    <>
      <AbsoluteFill style={{ width: W, height: H, zIndex: 0 }}>
        <Img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          width: W,
          height: H,
          zIndex: 1,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0.62) 100%)",
        }}
      />
    </>
  );
}

function FilmSegmentContent({ segment }: { segment: FilmSegmentInput }) {
  const { assetBundle, sceneTitle, frameDescription, characters, objects } = segment;
  const still = segment.stillSrc?.trim() ?? "";

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
      {still ? <GeneratedStillBackdrop src={still} /> : <AssetBundlePlate bundle={assetBundle} />}
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
          {sceneTitle.trim() || "—"}
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
            {frameDescription.trim() ? (
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
                {frameDescription}
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
            <CenteredAssetLine characters={characters} objects={objects} assetName={assetName} fontFamily={fontFamily} />
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
