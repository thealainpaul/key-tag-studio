export const KEYTAG_SPECS = {
  designAreaMm: { width: 46.0, height: 19.9 },
  safeAreaMm: { width: 44.0, height: 17.9 },
  dpi: 600,
  scale: 2,
};

/** DPI embedded in print PNG files (600 × 2). */
export const PRINT_DPI = KEYTAG_SPECS.dpi * KEYTAG_SPECS.scale;

/** Width of the red guide border, in millimetres. */
export const BORDER_WIDTH_MM = 2;

/**
 * Print bleed, in millimetres, added OUTWARD on every side of the production
 * file. The tag artwork keeps its exact 46.0 x 19.9 mm size; the canvas grows
 * around it, so the file handed to the manufacturer is larger than the tag.
 *
 * 2 mm matches BORDER_WIDTH_MM, so the red band in the exported file is the
 * same thickness the customer saw in the editor. The flat-paper industry
 * standard is 3 mm, but on a 19.9 mm tall tag that would throw away ~30% of the
 * file; 1-2 mm is normal for die-cut work at this scale. Change this one value
 * if the printer asks for a different figure.
 */
export const BLEED_MM = 2;

export function mmToPx(mm: number, dpi = KEYTAG_SPECS.dpi, scale = KEYTAG_SPECS.scale) {
  return Math.round((mm / 25.4) * dpi * scale);
}

export const CANVAS_W = mmToPx(KEYTAG_SPECS.designAreaMm.width);
export const CANVAS_H = mmToPx(KEYTAG_SPECS.designAreaMm.height);
export const SAFE_W = mmToPx(KEYTAG_SPECS.safeAreaMm.width);
export const SAFE_H = mmToPx(KEYTAG_SPECS.safeAreaMm.height);

/** Bleed in canvas px, and the resulting production-file dimensions. */
export const BLEED_PX = mmToPx(BLEED_MM);
export const BLEED_CANVAS_W = CANVAS_W + BLEED_PX * 2;
export const BLEED_CANVAS_H = CANVAS_H + BLEED_PX * 2;

/**
 * The tag face, MEASURED from keytag-mockup-top.png and held as fractions of
 * its bounding box, so the red editor is the same shape as the photographed
 * tag below it.
 *
 * The taper is not symmetric — the top edge slopes almost twice as steeply as
 * the bottom — and the two right corners have genuinely different radii. Round
 * numbers were never going to line up.
 */
const FACE = {
  leftTop: 0.2071,
  leftBottom: 0.8738,
  radiusTop: 0.0631,
  radiusBottom: 0.0796,
};

export type TagMetrics = {
  mmToPx: number;
  drawGeometry: (ctx: CanvasRenderingContext2D, insetMm?: number) => void;
};

export function getTagMetrics(canvasWidth: number, canvasHeight: number): TagMetrics {
  const mmToPxVal = canvasWidth / 46.0;
  const leftTopY = FACE.leftTop * canvasHeight;
  const leftBottomY = FACE.leftBottom * canvasHeight;
  const rTop = FACE.radiusTop * canvasWidth;
  const rBottom = FACE.radiusBottom * canvasWidth;

  const drawGeometry = (ctx: CanvasRenderingContext2D, insetMm = 0) => {
    const i = insetMm * mmToPxVal;
    const lX = i;
    const rX = canvasWidth - i;
    const tY = i;
    const bY = canvasHeight - i;

    ctx.beginPath();
    ctx.moveTo(lX, leftTopY + i);
    ctx.lineTo(rX - rTop, tY);
    ctx.quadraticCurveTo(rX, tY, rX, tY + rTop);
    ctx.lineTo(rX, bY - rBottom);
    ctx.quadraticCurveTo(rX, bY, rX - rBottom, bY);
    ctx.lineTo(lX, leftBottomY - i);
    ctx.closePath();
  };

  return { mmToPx: mmToPxVal, drawGeometry };
}

/** SVG path for instant server-side preview before JavaScript loads. */
export function keyTagSvgPath(canvasWidth = CANVAS_W, canvasHeight = CANVAS_H): string {
  const leftTopY = FACE.leftTop * canvasHeight;
  const leftBottomY = FACE.leftBottom * canvasHeight;
  const rTop = FACE.radiusTop * canvasWidth;
  const rBottom = FACE.radiusBottom * canvasWidth;
  return [
    `M 0 ${leftTopY}`,
    `L ${canvasWidth - rTop} 0`,
    `Q ${canvasWidth} 0 ${canvasWidth} ${rTop}`,
    `L ${canvasWidth} ${canvasHeight - rBottom}`,
    `Q ${canvasWidth} ${canvasHeight} ${canvasWidth - rBottom} ${canvasHeight}`,
    `L 0 ${leftBottomY}`,
    "Z",
  ].join(" ");
}

export function keyTagBorderWidth(canvasWidth = CANVAS_W): number {
  return Math.round(BORDER_WIDTH_MM * (canvasWidth / 46.0));
}

export function drawKeyTagFill(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  tagColor: string
): TagMetrics {
  const metrics = getTagMetrics(canvasWidth, canvasHeight);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.save();
  metrics.drawGeometry(ctx, 0);
  ctx.fillStyle = tagColor;
  ctx.fill();
  ctx.restore();
  return metrics;
}

/**
 * Red guide border.
 *
 * Stroked centred on the tag outline, which is the only way it can be an even
 * thickness the whole way round: on the top, right and bottom the outline runs
 * along the canvas edge, so anything drawn outside it is clipped away.
 *
 * The band therefore covers BORDER_WIDTH_MM / 2 of the tag on every side. That
 * is the trim margin — the printable area is what sits inside it, which is what
 * the hint text tells the customer. The mockup clips to the same inner edge.
 */
/** Editor overlay colour over the bleed ring. */
export type OverlayColor = "black" | "white";

/** How opaque that overlay is. 0.75 = the picture shows through at 25%. */
export const BLEED_OVERLAY_ALPHA = 0.75;

export function drawKeyTagBorder(
  ctx: CanvasRenderingContext2D,
  metrics: TagMetrics,
  color = "#ef4444"
) {
  ctx.save();
  metrics.drawGeometry(ctx, 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.round(BORDER_WIDTH_MM * metrics.mmToPx);
  // Round, NOT the default miter. A miter join projects outward at the tag's
  // acute corners and measured 2.725mm there against a 2mm target - a 36%
  // bulge. Round caps the perpendicular thickness at half the line width, so
  // the band is uniform the whole way around. Measured, not assumed.
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

/** Inset from the tag outline to the inner edge of the red band, in mm. */
export const PRINTABLE_INSET_MM = BORDER_WIDTH_MM / 2;

export function drawKeyTagShape(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  tagColor: string
): TagMetrics {
  const metrics = drawKeyTagFill(ctx, canvasWidth, canvasHeight, tagColor);
  drawKeyTagBorder(ctx, metrics);
  return metrics;
}
