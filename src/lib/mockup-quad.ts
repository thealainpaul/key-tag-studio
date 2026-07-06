import { CANVAS_H, CANVAS_W } from "@/lib/keytag-shape";

export type Point = { x: number; y: number };

export type Quad = {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
};

/** Corners of the printable trapezoid in design-canvas pixels. */
export function getDesignQuad(canvasW = CANVAS_W, canvasH = CANVAS_H): Quad {
  const mmToPxVal = canvasW / 46.0;
  const leftH = Math.round(14.0 * mmToPxVal);
  const leftTopY = Math.round((canvasH - leftH) / 2);
  const leftBottomY = leftTopY + leftH;
  return {
    tl: { x: 0, y: leftTopY },
    tr: { x: canvasW, y: 0 },
    br: { x: canvasW, y: canvasH },
    bl: { x: 0, y: leftBottomY },
  };
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  d0: Point,
  d1: Point,
  d2: Point
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  const denom = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
  const a = (d0.x * (sy1 - sy2) + d1.x * (sy2 - sy0) + d2.x * (sy0 - sy1)) / denom;
  const b = (d0.y * (sy1 - sy2) + d1.y * (sy2 - sy0) + d2.y * (sy0 - sy1)) / denom;
  const c = (d0.x * (sx2 - sx1) + d1.x * (sx0 - sx2) + d2.x * (sx1 - sx0)) / denom;
  const d = (d0.y * (sx2 - sx1) + d1.y * (sx0 - sx2) + d2.y * (sx1 - sx0)) / denom;
  const e =
    (d0.x * (sx1 * sy2 - sx2 * sy1) + d1.x * (sx2 * sy0 - sx0 * sy2) + d2.x * (sx0 * sy1 - sx1 * sy0)) /
    denom;
  const f =
    (d0.y * (sx1 * sy2 - sx2 * sy1) + d1.y * (sx2 * sy0 - sx0 * sy2) + d2.y * (sx0 * sy1 - sx1 * sy0)) /
    denom;

  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(source, 0, 0, sw, sh);
  ctx.restore();
}

/** Map the design trapezoid (red frame shape) onto the photo recess quad. */
export function drawDesignOnPhotoQuad(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  design: Quad,
  photo: Quad
) {
  const { tl, tr, br, bl } = design;
  const p = photo;
  drawTriangle(ctx, source, sw, sh, tl.x, tl.y, tr.x, tr.y, br.x, br.y, p.tl, p.tr, p.br);
  drawTriangle(ctx, source, sw, sh, tl.x, tl.y, bl.x, bl.y, br.x, br.y, p.tl, p.bl, p.br);
}
