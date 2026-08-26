import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";
import { liftColor, MIN_CHANNEL } from "@/lib/design";
import {
  BLEED_CANVAS_H,
  BLEED_CANVAS_W,
  BLEED_PX,
  CANVAS_H,
  CANVAS_W,
  drawKeyTagBorder,
  FRAME_COLOR_DEFAULT,
  getTagMetrics,
  PRINT_DPI,
} from "@/lib/keytag-shape";

import { drawQr, QR_DEFAULT_PX, qrDefaultCenter } from "@/lib/qrcode-render";
import { embedPngDpi } from "@/lib/png-dpi";

/** Enough for print (tag is ~2173px wide) without huge phone-photo payloads. */
const SUBMIT_IMAGE_MAX_PX = 2560;

const SUBMIT_JPEG_QUALITY = 0.9;

export function preloadImage(url: string, cache: Map<string, HTMLImageElement>) {
  const existing = cache.get(url);
  if (existing?.complete) return Promise.resolve(existing);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      cache.set(url, image);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}

export async function preloadAllImages(images: DesignImage[], cache: Map<string, HTMLImageElement>) {
  for (const img of images) {
    try {
      await preloadImage(img.url, cache);
    } catch {
      // skip broken
    }
  }
}

/**
 * A mask of the tag grown outward by the bleed.
 *
 * Fill plus a round-joined stroke of the same path: the stroke is centred, so
 * half its width lies outside, and a round join holds that distance
 * perpendicular at every point including the acute corners.
 */
function bleedShapeMask(): HTMLCanvasElement {
  const mask = document.createElement("canvas");
  mask.width = BLEED_CANVAS_W;
  mask.height = BLEED_CANVAS_H;
  const c = mask.getContext("2d");
  if (!c) return mask;
  c.translate(BLEED_PX, BLEED_PX);
  getTagMetrics(CANVAS_W, CANVAS_H).drawGeometry(c, 0);
  c.fillStyle = "#ffffff";
  c.fill();
  c.strokeStyle = "#ffffff";
  c.lineWidth = BLEED_PX * 2;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.stroke();
  return mask;
}


/**
 * Shadow colour as rgba, so opacity is applied without disturbing the hue the
 * customer picked. Accepts #rgb, #rrggbb and rgb()/rgba(); anything else is
 * passed through untouched rather than guessed at.
 */
function shadowRgba(css: string, alpha: number): string {
  const hex = css.trim();
  let r: number, g: number, b: number;
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (/^#[0-9a-f]{6}$/i.test(hex)) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else {
    return css;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Apply the manufacturer's 80% ink ceiling to a canvas in place.
 *
 * "Barcodes, oder deren Hintergruende sollten grundsaetzlich, wie auch
 * Schriften, auf 80% schwarz, also Grau, gestaltet werden."
 *
 * 80% ink means 20% of the paper still shows, so the darkest tone printable is
 * 51 of 255. This CLAMPS only the pixels that would go past that ceiling and
 * leaves everything else exactly as the customer made it.
 *
 * It does NOT lift the whole image. An earlier version did, which greyed every
 * picture and invented a grey background where there was none.
 *
 * The three channels are scaled by the SAME factor, so hue survives. A very
 * dark brown (40, 20, 10) reads as near-black in print, so it is lifted to
 * (51, 26, 13) - still brown, no longer darker than 80% ink. Clamping each
 * channel on its own would have flattened it to grey.
 */
export function applyInkCeiling(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;

    // How dark the pixel READS is set by its brightest channel. If that is
    // already at or above the ceiling the pixel prints lighter than 80% ink
    // and is left completely alone.
    const brightest = Math.max(d[i], d[i + 1], d[i + 2]);
    if (brightest >= MIN_CHANNEL) continue;

    if (brightest === 0) {
      // Absolute black. There is no ratio to preserve, so it becomes the
      // ceiling itself - 80% black, which is the grey the printer asked for.
      d[i] = MIN_CHANNEL;
      d[i + 1] = MIN_CHANNEL;
      d[i + 2] = MIN_CHANNEL;
      continue;
    }

    // Scale all three by the same factor, so the hue is unchanged and only the
    // darkness moves. A very dark brown (40, 20, 10) becomes (51, 26, 13):
    // still brown, no longer darker than 80% ink.
    const k = MIN_CHANNEL / brightest;
    d[i] = Math.round(d[i] * k);
    d[i + 1] = Math.round(d[i + 1] * k);
    d[i + 2] = Math.round(d[i + 2] * k);
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Paints ONLY the bleed ring: the tag colour and the customer's picture carried
 * 2mm outward past the tag edge, with the tag itself punched out so nothing
 * covers the artwork area.
 *
 * Drawn on the same bleed-sized canvas the coloured frame used to occupy. The
 * tag canvas stays 46.0 x 19.9mm and so does the mockup that reads it.
 *
 * The context must already be translated by BLEED_PX so that tag coordinates
 * line up with the tag canvas exactly.
 */
function paintBleedRing(
  ctx: CanvasRenderingContext2D,
  tagColor: string,
  images: DesignImage[],
  cache: Map<string, HTMLImageElement>
) {
  const metrics = getTagMetrics(CANVAS_W, CANVAS_H);

  // Tag colour first, so anywhere the customer's picture does not reach shows
  // the colour they picked rather than nothing.
  ctx.save();
  ctx.fillStyle = tagColor;
  ctx.fillRect(-BLEED_PX, -BLEED_PX, BLEED_CANVAS_W, BLEED_CANVAS_H);
  ctx.restore();

  // The picture, at the same coordinates as on the tag, so it simply continues.
  for (const item of images) {
    const image = cache.get(item.url);
    if (!image?.complete) continue;
    ctx.save();
    const centerX = item.x + item.width / 2;
    const centerY = item.y + item.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.drawImage(image, -item.width / 2, -item.height / 2, item.width, item.height);
    ctx.restore();
  }

  // Trim to the dilated tag, then punch the tag itself out. What is left is
  // exactly the 2mm ring.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(bleedShapeMask(), 0, 0);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  metrics.drawGeometry(ctx, 0);
  ctx.fill();
  ctx.restore();
}

/**
 * Paints tag fill, artwork, text and QR into the current context, at the
 * context's current origin. Does NOT resize or clear the canvas — callers own
 * that, so the same paint can be dropped onto a plain canvas or onto one that
 * has already been offset and pre-painted with a bleed band.
 */
function paintTagContent(
  ctx: CanvasRenderingContext2D,
  tagColor: string,
  images: DesignImage[],
  textLines: TextLine[],
  cache: Map<string, HTMLImageElement>,
  qrCode?: DesignPayload["qrCode"]
) {
  const metrics = getTagMetrics(CANVAS_W, CANVAS_H);

  ctx.save();
  metrics.drawGeometry(ctx, 0);
  ctx.fillStyle = tagColor;
  ctx.fill();
  ctx.restore();

  for (const item of images) {
    const image = cache.get(item.url);
    if (!image?.complete) continue;

    ctx.save();
    metrics.drawGeometry(ctx, 0);
    ctx.clip();

    const centerX = item.x + item.width / 2;
    const centerY = item.y + item.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.drawImage(image, -item.width / 2, -item.height / 2, item.width, item.height);
    ctx.restore();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  textLines.forEach((line) => {
    if (!line.text.trim()) return;

    const weight = line.bold ? "bold " : "";
    const style = line.italic ? "italic " : "";
    ctx.font = `${style}${weight}${line.fontSize}px "${line.fontFamily}"`;

    ctx.save();

    // Shadow. A light colour makes this read as a glow or a light source
    // rather than a shadow, which is the point of leaving the colour free.
    const sh = line.shadow;
    if (sh?.enabled) {
      const a = Math.max(0, Math.min(1, sh.opacity));
      ctx.shadowColor = shadowRgba(sh.color, a);
      ctx.shadowOffsetX = sh.dx;
      ctx.shadowOffsetY = sh.dy;
      ctx.shadowBlur = sh.blur;
    }

    ctx.fillStyle = line.color;
    ctx.fillText(line.text, line.x, line.y);

    // Rules are drawn without the shadow, otherwise a blurred bar doubles up
    // under the glyphs and muddies small type.
    if (line.underline || line.strike) {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      // Positioned from the MEASURED glyphs, not from a fraction of the font
      // size. textBaseline is "middle" here, so line.y is the vertical centre;
      // a fixed fraction put the underline inside the letters and the strike
      // above centre. actualBoundingBox gives the real ink extent for whatever
      // face and weight the customer picked.
      const m = ctx.measureText(line.text);
      const w = m.width;
      const x0 = ctx.textAlign === "center" ? line.x - w / 2 : line.x;
      const thickness = Math.max(1, line.fontSize * 0.06);
      const ascent = m.actualBoundingBoxAscent || line.fontSize * 0.35;
      const descent = m.actualBoundingBoxDescent || line.fontSize * 0.35;
      ctx.fillStyle = line.color;
      if (line.underline) {
        // Clear of the descenders, so "g" and "y" are not cut through.
        ctx.fillRect(x0, line.y + descent + thickness * 1.5, w, thickness);
      }
      if (line.strike) {
        // Through the middle of the ink, not the middle of the line box.
        ctx.fillRect(x0, line.y - ascent / 2 + descent / 2 - thickness / 2, w, thickness);
      }
    }

    ctx.restore();
  });

  // QR — drawn last so it sits on top of artwork and text
  if (qrCode?.enabled && qrCode.url.trim()) {
    const size = qrCode.size ?? QR_DEFAULT_PX;
    const fallback = qrDefaultCenter(size);
    ctx.save();
    metrics.drawGeometry(ctx, 0);
    ctx.clip();
    drawQr(
      ctx,
      qrCode.url,
      qrCode.x ?? fallback.x,
      qrCode.y ?? fallback.y,
      size,
      qrCode.color ?? "#000000",
      qrCode.halo ?? true
    );
    ctx.restore();
  }
}

/** Editor / mockup preview layer — tag-sized canvas, no bleed. */
export function drawContentLayer(
  canvas: HTMLCanvasElement,
  tagColor: string,
  images: DesignImage[],
  textLines: TextLine[],
  cache: Map<string, HTMLImageElement>,
  qrCode?: DesignPayload["qrCode"]
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  paintTagContent(ctx, tagColor, images, textLines, cache, qrCode);

  // The manufacturer's 80% ink ceiling, applied last so it covers the
  // uploaded picture, the tag colour, the text and the QR alike.
  applyInkCeiling(ctx, CANVAS_W, CANVAS_H);
}

/**
 * Production print layer — the tag at its exact size, on a canvas grown by
 * BLEED_MM on every side, with the red bleed band filling that outer ring.
 *
 * The band is stroked centred on the tag outline at twice the bleed width, so
 * it covers BLEED_MM outside and BLEED_MM inside. The artwork is then painted
 * on top, clipped to the outline, which overpaints the inner half. What is left
 * is a red ring exactly BLEED_MM wide sitting wholly outside the tag — the tag
 * artwork itself is never scaled down or encroached on.
 */
export function drawPrintLayer(
  canvas: HTMLCanvasElement,
  tagColor: string,
  images: DesignImage[],
  textLines: TextLine[],
  cache: Map<string, HTMLImageElement>,
  qrCode?: DesignPayload["qrCode"]
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = BLEED_CANVAS_W;
  canvas.height = BLEED_CANVAS_H;
  ctx.clearRect(0, 0, BLEED_CANVAS_W, BLEED_CANVAS_H);

  ctx.save();
  ctx.translate(BLEED_PX, BLEED_PX);

  // The bleed: 2mm of the customer's own picture carried outward. No frame and
  // no overlay - the printer trims into real artwork.
  paintBleedRing(ctx, tagColor, images, cache);

  paintTagContent(ctx, tagColor, images, textLines, cache, qrCode);

  ctx.restore();

  // The manufacturer's 80% ink ceiling, applied last so it covers the
  // uploaded picture, the tag colour, the text and the QR alike.
  applyInkCeiling(ctx, BLEED_CANVAS_W, BLEED_CANVAS_H);
}

/**
/**
 * Editor bleed layer: the customer's picture carried 1mm past the tag edge.
 *
 * No dimming overlay - the ring simply shows the artwork continuing outward,
 * which is exactly what the manufacturer prints and then trims.
 */
export function drawBleedLayer(
  canvas: HTMLCanvasElement,
  tagColor: string,
  images: DesignImage[],
  cache: Map<string, HTMLImageElement>
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = BLEED_CANVAS_W;
  canvas.height = BLEED_CANVAS_H;
  ctx.clearRect(0, 0, BLEED_CANVAS_W, BLEED_CANVAS_H);

  ctx.save();
  ctx.translate(BLEED_PX, BLEED_PX);
  paintBleedRing(ctx, tagColor, images, cache);
  ctx.restore();

  // The manufacturer's 80% ink ceiling, applied last so it covers the
  // uploaded picture, the tag colour, the text and the QR alike.
  applyInkCeiling(ctx, BLEED_CANVAS_W, BLEED_CANVAS_H);
}

/**
 * Frame colour taken from the customer's image.
 *
 * The band marks the bleed for the printer, so it has to stay visible against
 * whatever artwork sits next to it. Mean colour of the image, hue rotated 180
 * degrees, saturation and lightness forced to a vivid mid value - that is
 * always distinguishable from the image it borders.
 */
export function frameColorForImage(img: HTMLImageElement): string {
  const w = 32;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w)) || 1;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return FRAME_COLOR_DEFAULT;
  try {
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    if (!n) return FRAME_COLOR_DEFAULT;
    return hueRotatedVivid(r / n / 255, g / n / 255, b / n / 255);
  } catch {
    return FRAME_COLOR_DEFAULT;
  }
}

function hueRotatedVivid(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0;
  if (max !== min) {
    const dmax = max - min;
    if (max === r) hue = ((g - b) / dmax + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / dmax + 2) / 6;
    else hue = ((r - g) / dmax + 4) / 6;
  }
  return hslToHex((hue + 0.5) % 1, 0.85, 0.5);
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function mergedPreviewDataUrl(
  contentCanvas: HTMLCanvasElement,
  borderCanvas: HTMLCanvasElement,
  mime: "image/png" | "image/jpeg" = "image/png"
): string {
  // The border canvas is the full bleed size and the content canvas is the tag,
  // so the merge happens at bleed size with the content offset inward. Drawing
  // both at 0,0 would put the band a bleed-width off from the artwork.
  const merged = document.createElement("canvas");
  merged.width = BLEED_CANVAS_W;
  merged.height = BLEED_CANVAS_H;
  const ctx = merged.getContext("2d");
  if (!ctx) return contentCanvas.toDataURL(mime, SUBMIT_JPEG_QUALITY);
  ctx.drawImage(contentCanvas, BLEED_PX, BLEED_PX);
  ctx.drawImage(borderCanvas, 0, 0);
  return merged.toDataURL(mime, SUBMIT_JPEG_QUALITY);
}

function scaledDimensions(w: number, h: number, maxPx: number) {
  if (Math.max(w, h) <= maxPx) return { width: w, height: h };
  const scale = maxPx / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export async function imageUrlToDataUrl(url: string, cache: Map<string, HTMLImageElement>): Promise<string> {
  const img = await preloadImage(url, cache);
  const { width, height } = scaledDimensions(img.naturalWidth, img.naturalHeight, SUBMIT_IMAGE_MAX_PX);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return url;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", SUBMIT_JPEG_QUALITY);
}

/**
 * Production print file for the manufacturer — tag artwork at full size with
 * the red bleed band added outward, 1200 DPI tagged.
 *
 * The customer-facing mockup is a separate file and is unaffected by this.
 */
export async function printFileBlob(
  payload: DesignPayload,
  cache: Map<string, HTMLImageElement>
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawPrintLayer(
    canvas,
    payload.tagColor,
    payload.images,
    payload.textLines,
    cache,
    payload.qrCode
  );
  const raw = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!raw) throw new Error("PNG export failed");
  const tagged = embedPngDpi(new Uint8Array(await raw.arrayBuffer()), PRINT_DPI);
  return new Blob([tagged.slice().buffer], { type: "image/png" });
}

export async function printFileDataUrl(
  payload: DesignPayload,
  cache: Map<string, HTMLImageElement>
): Promise<string> {
  const blob = await printFileBlob(payload, cache);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

/**
 * Source image for "design it for me", passed through EXACTLY as the customer
 * supplied it — no resizing, no re-encoding. BIK does design work from this
 * file, so it must be the untouched original.
 *
 * NOTE: the ceiling on this is the WordPress server's post_max_size /
 * upload_max_filesize. That figure is not declared anywhere in the plugin
 * source and has not been measured, so no downscale threshold is applied here —
 * any threshold would be invented rather than derived. If large uploads start
 * failing, read that server value first; the limit belongs here once it is a
 * known number.
 */
export async function fullSourceDataUrl(dataUrl: string): Promise<string> {
  return dataUrl;
}

export async function payloadForSubmit(
  payload: DesignPayload,
  cache: Map<string, HTMLImageElement>
): Promise<DesignPayload> {
  const images = await Promise.all(
    payload.images.map(async (img) => {
      const source = img.originalUrl || img.url;
      const full = await imageUrlToDataUrl(source, cache);
      return { ...img, url: full, originalUrl: full };
    })
  );
  return { ...payload, images };
}
/**
 * The mockup turned upright, for the second image emailed on a vertical order.
 *
 * The mockup canvas is always drawn landscape. Rotating it clockwise
 * puts the ring hole at the top, which is how the customer designed it. The
 * landscape original is still sent alongside this one.
 */
export function rotatedMockupDataUrl(source: HTMLCanvasElement): string {
  const out = document.createElement("canvas");
  out.width = source.height;
  out.height = source.width;
  const ctx = out.getContext("2d");
  if (!ctx) return source.toDataURL("image/jpeg", 0.9);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out.toDataURL("image/jpeg", 0.9);
}
