export type Point = { x: number; y: number };

export type Quad = {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
};

/** Map a rectangle onto a quad using two affine triangle transforms. */
export function drawImageInQuad(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  quad: Quad
) {
  const { tl, tr, br, bl } = quad;

  drawTriangle(ctx, source, 0, 0, sw, 0, sw, sh, tl, tr, br);
  drawTriangle(ctx, source, 0, 0, 0, sh, sw, sh, tl, bl, br);
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
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

  const t = affineFromTriangles(sx0, sy0, sx1, sy1, sx2, sy2, d0.x, d0.y, d1.x, d1.y, d2.x, d2.y);
  ctx.transform(t.a, t.b, t.c, t.d, t.e, t.f);
  ctx.drawImage(source, 0, 0, sw, sh);
  ctx.restore();
}

function affineFromTriangles(
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  dx0: number,
  dy0: number,
  dx1: number,
  dy1: number,
  dx2: number,
  dy2: number
) {
  const denom = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
  const a = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / denom;
  const b = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / denom;
  const c = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / denom;
  const d = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / denom;
  const e =
    (dx0 * (sx1 * sy2 - sx2 * sy1) + dx1 * (sx2 * sy0 - sx0 * sy2) + dx2 * (sx0 * sy1 - sx1 * sy0)) /
    denom;
  const f =
    (dy0 * (sx1 * sy2 - sx2 * sy1) + dy1 * (sx2 * sy0 - sx0 * sy2) + dy2 * (sx0 * sy1 - sx1 * sy0)) /
    denom;
  return { a, b, c, d, e, f };
}
