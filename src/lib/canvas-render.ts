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
 * The manufacturer's 80% ink rule, for SOLID ink areas.
 *
 * "Barcodes, oder deren Hintergruende sollten grundsaetzlich, wie auch
 * Schriften, auf 80% schwarz, also Grau, gestaltet werden."
 *
 * The reason is ink spread, not contrast. A 100% solid lays down enough ink to
 * creep sideways and close the white gaps between the modules, and the code
 * stops scanning. Less ink, less spread.
 *
 * Applied to the QR modules AND to the base colour behind them. They are the
 * same requirement: the base is solid ink pressed right against the code's
 * white gaps, so if it is laid at 100% it spreads into them and the gaps close
 * just as surely as if the modules themselves were too heavy. He named the
 * barcode, its background and the Grundflaeche together for that reason.
 *
 * NOT applied to photographs. They have no fine white gaps to close, and
 * earlier versions that capped the whole image flattened shadows and greyed
 * entire pictures.
 *
 * 80% ink leaves 20% of the substrate showing, so the darkest tone is 51/255.
 */
export function capSolidInk(color: string): string {
  const hex = color.trim();
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
    return color; // not a form we can read - left untouched rather than guessed at
  }

  const m = Math.max(r, g, b);
  if (m >= MIN_CHANNEL) return color; // already lighter than 80% ink

  // Add the same amount to all three, so the customer's chosen hue survives.
  const lift = MIN_CHANNEL - m;
  const to = (v: number) => Math.min(255, v + lift).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
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
  ctx.fillStyle = capSolidInk(tagColor);
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
  ctx.fillStyle = capSolidInk(tagColor);
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

    const tracking = line.letterSpacing ?? 0;
    const chars = Array.from(line.text);

    // Advance of the whole line, tracking included. measureText does not know
    // about our tracking, so it is added per gap.
    const runWidth =
      chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + tracking * Math.max(0, chars.length - 1);

    const m0 = ctx.measureText(line.text);
    const ascent = m0.actualBoundingBoxAscent || line.fontSize * 0.35;
    const descent = m0.actualBoundingBoxDescent || line.fontSize * 0.35;

    // Stacked: each glyph stays UPRIGHT and they run downward. The step is the
    // glyph height plus tracking, so the same control spaces both layouts.
    const step = line.fontSize + tracking;
    const stackHeight = line.stacked ? step * Math.max(0, chars.length - 1) : 0;

    ctx.save();

    // Rotate about the line's own centre, so the text turns in place rather
    // than swinging away from where the customer put it.
    const angle = ((line.angle ?? 0) % 360) * (Math.PI / 180);
    if (angle) {
      ctx.translate(line.x, line.y);
      ctx.rotate(angle);
      ctx.translate(-line.x, -line.y);
    }

    const sh = line.shadow;
    if (sh?.enabled) {
      const alpha = Math.max(0, Math.min(1, sh.opacity));
      ctx.shadowColor = shadowRgba(sh.color, alpha);
      ctx.shadowOffsetX = sh.dx;
      ctx.shadowOffsetY = sh.dy;
      ctx.shadowBlur = sh.blur;
    }

    ctx.fillStyle = line.color;

    if (line.stacked) {
      const prevAlign = ctx.textAlign;
      ctx.textAlign = "center";
      let y = line.y - stackHeight / 2;
      for (const c of chars) {
        ctx.fillText(c, line.x, y);
        y += step;
      }
      ctx.textAlign = prevAlign;
    } else if (tracking) {
      // Drawn glyph by glyph so the tracking is applied; fillText alone cannot.
      const prevAlign = ctx.textAlign;
      ctx.textAlign = "left";
      let x = prevAlign === "center" ? line.x - runWidth / 2 : line.x;
      for (const c of chars) {
        ctx.fillText(c, x, line.y);
        x += ctx.measureText(c).width + tracking;
      }
      ctx.textAlign = prevAlign;
    } else {
      ctx.fillText(line.text, line.x, line.y);
    }

    // Rules are drawn without the shadow, otherwise a blurred bar doubles up
    // under the glyphs and muddies small type. Stacked text gets no rules -
    // a single bar across a vertical column of letters is meaningless.
    if ((line.underline || line.strike) && !line.stacked) {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      const w = runWidth;
      const x0 = ctx.textAlign === "center" ? line.x - w / 2 : line.x;
      const thickness = Math.max(1, line.fontSize * 0.06);
      ctx.fillStyle = line.color;
      if (line.underline) {
        ctx.fillRect(x0, line.y + descent + thickness * 1.5, w, thickness);
      }
      if (line.strike) {
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
      capSolidInk(qrCode.color ?? "#000000"),
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
