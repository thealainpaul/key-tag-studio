import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";
import { CANVAS_H, CANVAS_W, drawKeyTagBorder, drawKeyTagFill, getTagMetrics } from "@/lib/keytag-shape";

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

export function drawContentLayer(
  canvas: HTMLCanvasElement,
  tagColor: string,
  images: DesignImage[],
  textLines: TextLine[],
  cache: Map<string, HTMLImageElement>
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const metrics = drawKeyTagFill(ctx, CANVAS_W, CANVAS_H, tagColor);

  for (const item of images) {
    const image = cache.get(item.url);
    if (!image?.complete) continue;

    ctx.save();
    metrics.drawGeometry(ctx, 0);
    ctx.clip();

    const nw = image.naturalWidth;
    const nh = image.naturalHeight;
    const centerX = item.x + item.width / 2;
    const centerY = item.y + item.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.drawImage(image, -nw / 2, -nh / 2, nw, nh);
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
  borderCanvas: HTMLCanvasElement
): string {
  const merged = document.createElement("canvas");
  merged.width = CANVAS_W;
  merged.height = CANVAS_H;
  const ctx = merged.getContext("2d");
  if (!ctx) return contentCanvas.toDataURL("image/png");
  ctx.drawImage(contentCanvas, 0, 0);
  ctx.drawImage(borderCanvas, 0, 0);
  return merged.toDataURL("image/png");
}

/** Production print file — tag artwork only, no red guide border. */
export function printFileDataUrl(
  payload: DesignPayload,
  cache: Map<string, HTMLImageElement>
): string {
  const canvas = document.createElement("canvas");
  drawContentLayer(canvas, payload.tagColor, payload.images, payload.textLines, cache);
  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function imageUrlToDataUrl(url: string, cache: Map<string, HTMLImageElement>): Promise<string> {
  if (url.startsWith("data:")) return url;
  const img = await preloadImage(url, cache);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return url;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function payloadForSubmit(
  payload: DesignPayload,
  cache: Map<string, HTMLImageElement>
): Promise<DesignPayload> {
  const images = await Promise.all(
    payload.images.map(async (img) => ({
      ...img,
      url: await imageUrlToDataUrl(img.url, cache),
    }))
  );
  return { ...payload, images };
}
