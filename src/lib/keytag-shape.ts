export const KEYTAG_SPECS = {
  /**
   * The VISIBLE printed area, from the manufacturer's own drawing
   * (00_Folie_BIKAG_Vorlage.pdf, red outline). This is what the customer sees
   * on the finished tag.
   */
  designAreaMm: { width: 44.0, height: 17.9 },
  /** Kept for the QR size cap. Same figures - the print area IS the safe area. */
  safeAreaMm: { width: 44.0, height: 17.9 },
  dpi: 600,
  scale: 2,
};

/** DPI embedded in print PNG files (600 x 2 = 1200), as the manufacturer requires. */
export const PRINT_DPI = KEYTAG_SPECS.dpi * KEYTAG_SPECS.scale;

/**
 * Print bleed, in millimetres, added OUTWARD on every side.
 *
 * The manufacturer's figure, stated directly: "Die sichtbare Druckbild hat ein
 * Mass von 44.0 mm auf 17.9 mm! Um einen sauberen Schnitt zu erreichen,
 * benoetigen wir ein Uebermass von 1 mm je Seite. Das zu fuellende Mass inkl.
 * Ueberdruck ist also 46.0 mm x 19.9 mm."
 *
 * So 44.0 x 17.9 visible, 1 mm per side, 46.0 x 19.9 delivered. Earlier builds
 * treated 46.0 x 19.9 as the visible area and added a further 2 mm, which is
 * why every file sent to him came back marked "Groesse stimmt nicht".
 */
export const BLEED_MM = 1;

/**
 * Width of the guide band drawn by drawKeyTagBorder, in millimetres.
 *
 * Only the pre-load placeholder and the admin editor still draw a band. The
 * customer editor shows the picture carried into the bleed instead. Kept equal
 * to BLEED_MM so any band that is drawn matches the real bleed.
 */
export const BORDER_WIDTH_MM = BLEED_MM;

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
 * The tag outline, taken from the manufacturer's vector file
 * 00_Folie_BIKAG_Vorlage.pdf and held as fractions of the canvas so it scales
 * with CANVAS_W / CANVAS_H.
 *
 * EIGHT segments: four straight, four cubic Beziers. Reproduced control point
 * for control point, verified to 0.00000000000000000000 mm against his file.
 *
 * This replaced four fractions that had been measured off a PHOTOGRAPH of a
 * tag. Those disagreed with his drawing by 2.7% and no amount of adjustment
 * elsewhere could have reconciled them.
 *
 * DO NOT straighten the curves. Drawing lines between the control points cuts
 * the corners off and is not the shape he manufactures.
 */
function traceFace(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number) {
  const X = (u: number) => inset + u * (w - inset * 2);
  const Y = (v: number) => inset + v * (h - inset * 2);
  ctx.beginPath();
  ctx.moveTo(X(0.0), Y(0.817970452125766));
  ctx.bezierCurveTo(X(8.020945295547366e-06), Y(0.6248842279592176), X(8.819216686257704e-05), Y(0.2336466800085979), X(0.00010422641117598298), Y(0.1649224644034102));
  ctx.lineTo(X(0.9262051011529898), Y(0.00037441010672717976));
  ctx.lineTo(X(0.9264215213966935), Y(0.00039410798784415184));
  ctx.bezierCurveTo(X(0.9273516757849802), Y(0.00039410798784415184), X(0.932234405206381), Y(0.0), X(0.9337417618048396), Y(0.0));
  ctx.bezierCurveTo(X(0.979514826858835), Y(0.0), X(1.0), Y(0.08435324375609121), X(1.0), Y(0.16793789423485875));
  ctx.lineTo(X(1.0), Y(0.8324169683562562));
  ctx.bezierCurveTo(X(1.0), Y(0.9326751985557694), X(0.9711042884224881), Y(1.0), X(0.9280732397179166), Y(1.0));
  ctx.lineTo(X(0.0), Y(0.817970452125766));
  ctx.closePath();
}

export type TagMetrics = {
  mmToPx: number;
  drawGeometry: (ctx: CanvasRenderingContext2D, insetMm?: number) => void;
};

export function getTagMetrics(canvasWidth: number, canvasHeight: number): TagMetrics {
  const mmToPxVal = canvasWidth / KEYTAG_SPECS.designAreaMm.width;

  const drawGeometry = (ctx: CanvasRenderingContext2D, insetMm = 0) => {
    traceFace(ctx, canvasWidth, canvasHeight, insetMm * mmToPxVal);
  };

  return { mmToPx: mmToPxVal, drawGeometry };
}

/** SVG path for instant server-side preview before JavaScript loads. */
export function keyTagSvgPath(canvasWidth = CANVAS_W, canvasHeight = CANVAS_H): string {
  const X = (u: number) => u * canvasWidth;
  const Y = (v: number) => v * canvasHeight;
  return [
    `M ${X(0.0)} ${Y(0.817970452125766)}`,
    `C ${X(8.020945295547366e-06)} ${Y(0.6248842279592176)}, ${X(8.819216686257704e-05)} ${Y(0.2336466800085979)}, ${X(0.00010422641117598298)} ${Y(0.1649224644034102)}`,
    `L ${X(0.9262051011529898)} ${Y(0.00037441010672717976)}`,
    `L ${X(0.9264215213966935)} ${Y(0.00039410798784415184)}`,
    `C ${X(0.9273516757849802)} ${Y(0.00039410798784415184)}, ${X(0.932234405206381)} ${Y(0.0)}, ${X(0.9337417618048396)} ${Y(0.0)}`,
    `C ${X(0.979514826858835)} ${Y(0.0)}, ${X(1.0)} ${Y(0.08435324375609121)}, ${X(1.0)} ${Y(0.16793789423485875)}`,
    `L ${X(1.0)} ${Y(0.8324169683562562)}`,
    `C ${X(1.0)} ${Y(0.9326751985557694)}, ${X(0.9711042884224881)} ${Y(1.0)}, ${X(0.9280732397179166)} ${Y(1.0)}`,
    `L ${X(0.0)} ${Y(0.817970452125766)}`,
    "Z"
  ].join(' ');
}


export function keyTagBorderWidth(canvasWidth = CANVAS_W): number {
  return Math.round(BORDER_WIDTH_MM * (canvasWidth / KEYTAG_SPECS.designAreaMm.width));
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
/** Default frame colour, used until an image supplies one. */
export const FRAME_COLOR_DEFAULT = "#ef4444";

export function drawKeyTagBorder(
  ctx: CanvasRenderingContext2D,
  metrics: TagMetrics,
  color: string = FRAME_COLOR_DEFAULT
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
