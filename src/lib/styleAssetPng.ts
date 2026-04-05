/** Max size per asset when stored as data URL in localStorage */
export const MAX_STYLE_ASSET_BYTES = 3 * 1024 * 1024;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === "string") resolve(r.result);
      else reject(new Error("Unexpected read result"));
    };
    r.onerror = () => reject(r.error ?? new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

/** True if any pixel has alpha below 255 */
export function imageDataHasTransparency(dataUrl: string): Promise<boolean> {
  return loadImage(dataUrl).then((img) => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w === 0 || h === 0) return false;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 255) return true;
    }
    return false;
  });
}

export type ValidatePngResult =
  | { ok: true; dataUrl: string; width: number; height: number }
  | { ok: false; reason: string };

/**
 * Style kit assets must be transparent PNGs. Rejects non-PNG, oversize files,
 * and fully opaque images (no usable alpha).
 */
export async function validateTransparentStylePng(file: File): Promise<ValidatePngResult> {
  if (file.type !== "image/png") {
    return { ok: false, reason: "Use a PNG file with transparency." };
  }
  if (file.size > MAX_STYLE_ASSET_BYTES) {
    return { ok: false, reason: "File is too large." };
  }
  let dataUrl: string;
  try {
    dataUrl = await readFileAsDataUrl(file);
  } catch {
    return { ok: false, reason: "Could not read file." };
  }
  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    return { ok: false, reason: "Could not decode image." };
  }
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const transparent = await imageDataHasTransparency(dataUrl);
  if (!transparent) {
    return { ok: false, reason: "PNG must include transparent pixels (alpha channel)." };
  }
  return { ok: true, dataUrl, width, height };
}

export type ValidateBackgroundImageResult =
  | { ok: true; dataUrl: string }
  | { ok: false; reason: string };

/**
 * Full-bleed style background: any common raster image, decoded and stored as data URL.
 */
export async function validateBackgroundImageFile(file: File): Promise<ValidateBackgroundImageResult> {
  if (file.type && !file.type.startsWith("image/")) {
    return { ok: false, reason: "Choose an image file." };
  }
  if (file.size > MAX_STYLE_ASSET_BYTES) {
    return { ok: false, reason: "File is too large." };
  }
  let dataUrl: string;
  try {
    dataUrl = await readFileAsDataUrl(file);
  } catch {
    return { ok: false, reason: "Could not read file." };
  }
  try {
    await loadImage(dataUrl);
  } catch {
    return { ok: false, reason: "Could not decode image." };
  }
  return { ok: true, dataUrl };
}
