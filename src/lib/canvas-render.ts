import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";
import {
  BLEED_CANVAS_H,
  BLEED_CANVAS_W,
  BLEED_PX,
  CANVAS_H,
  CANVAS_W,
  drawKeyTagBorder,
  getTagMetrics,
  PRINT_DPI,
} from "@/lib/keytag-shape";

/** Same red as the editor's guide border. */
const BLEED_COLOR = "#ef4444";
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
    ctx.font = `${line.fontSize}px "${line.fontFamily}"`;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, line.x, line.y);
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

  const metrics = getTagMetrics(CANVAS_W, CANVAS_H);
  ctx.save();
  metrics.drawGeometry(ctx, 0);
  ctx.strokeStyle = BLEED_COLOR;
  ctx.lineWidth = BLEED_PX * 2;
  ctx.stroke();
  ctx.restore();

  paintTagContent(ctx, tagColor, images, textLines, cache, qrCode);

  ctx.restore();
}

export function drawBorderLayer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  drawKeyTagBorder(ctx, getTagMetrics(CANVAS_W, CANVAS_H));
}

export function mergedPreviewDataUrl(
  contentCanvas: HTMLCanvasElement,
  borderCanvas: HTMLCanvasElement,
  mime: "image/png" | "image/jpeg" = "image/png"
): string {
  const merged = document.createElement("canvas");
  merged.width = CANVAS_W;
  merged.height = CANVAS_H;
  const ctx = merged.getContext("2d");
  if (!ctx) return contentCanvas.toDataURL(mime, SUBMIT_JPEG_QUALITY);
  ctx.drawImage(contentCanvas, 0, 0);
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
  drawPrintLayer(canvas, payload.tagColor, payload.images, payload.textLines, cache, payload.qrCode);
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
