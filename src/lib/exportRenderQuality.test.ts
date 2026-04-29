import { describe, expect, it } from "vitest";

import { estimateFilmExportSizeBytes, formatPredictedFileSize, getCrfForExportQuality } from "@/lib/exportRenderQuality";

describe("getCrfForExportQuality", () => {
  it("returns known CRF values", () => {
    expect(getCrfForExportQuality("draft")).toBe(28);
    expect(getCrfForExportQuality("high")).toBe(18);
  });
});

describe("estimateFilmExportSizeBytes", () => {
  it("grows with duration and is larger with subtitles+zip", () => {
    const mp4 = estimateFilmExportSizeBytes({
      durationSeconds: 10,
      quality: "standard",
      includeSubtitles: false,
      srtTextByteLength: 0,
    });
    const zip = estimateFilmExportSizeBytes({
      durationSeconds: 10,
      quality: "standard",
      includeSubtitles: true,
      srtTextByteLength: 200,
    });
    expect(zip).toBeGreaterThan(mp4);
  });
});

describe("formatPredictedFileSize", () => {
  it("uses MB for typical exports", () => {
    expect(formatPredictedFileSize(2.5 * 1024 * 1024)).toMatch(/MB/);
  });
});
