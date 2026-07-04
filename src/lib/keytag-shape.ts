export const KEYTAG_SPECS = {
  designAreaMm: { width: 46.0, height: 19.9 },
  safeAreaMm: { width: 44.0, height: 17.9 },
  dpi: 600,
  scale: 2,
};

export function mmToPx(mm: number, dpi = KEYTAG_SPECS.dpi, scale = KEYTAG_SPECS.scale) {
  return Math.round((mm / 25.4) * dpi * scale);
}

export const CANVAS_W = mmToPx(KEYTAG_SPECS.designAreaMm.width);
export const CANVAS_H = mmToPx(KEYTAG_SPECS.designAreaMm.height);
export const SAFE_W = mmToPx(KEYTAG_SPECS.safeAreaMm.width);
export const SAFE_H = mmToPx(KEYTAG_SPECS.safeAreaMm.height);

export type TagMetrics = {
  mmToPx: number;
  drawGeometry: (ctx: CanvasRenderingContext2D, insetMm?: number) => void;
};

export function getTagMetrics(canvasWidth: number, canvasHeight: number): TagMetrics {
  const mmToPxVal = canvasWidth / 46.0;
  const leftH = Math.round(14.0 * mmToPxVal);
  const cornerRadius = Math.round(4 * mmToPxVal);
  const leftTopY = Math.round((canvasHeight - leftH) / 2);
  const leftBottomY = leftTopY + leftH;

  const drawGeometry = (ctx: CanvasRenderingContext2D, insetMm = 0) => {
    const iPx = insetMm * mmToPxVal;
    const lX = 0 + iPx;
    const rX = canvasWidth - iPx;
    const rY_t = 0 + iPx;
    const rY_b = canvasHeight - iPx;
    const slopeRatio = (canvasHeight - leftH) / (2 * canvasWidth);
    const lY_t = leftTopY + iPx * slopeRatio;
    const lY_b = leftBottomY - iPx * slopeRatio;

    ctx.beginPath();
    ctx.moveTo(lX, lY_t);
    ctx.lineTo(rX - cornerRadius, rY_t);
    ctx.quadraticCurveTo(rX, rY_t, rX, rY_t + cornerRadius);
    ctx.lineTo(rX, rY_b - cornerRadius);
    ctx.quadraticCurveTo(rX, rY_b, rX - cornerRadius, rY_b);
    ctx.lineTo(lX, lY_b);
    ctx.closePath();
  };

  return { mmToPx: mmToPxVal, drawGeometry };
}

export function drawKeyTagShape(
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

  ctx.save();
  metrics.drawGeometry(ctx, 0);
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = Math.round(2 * metrics.mmToPx);
  ctx.stroke();
  ctx.restore();

  return metrics;
}
