import qrcodeGenerator from "qrcode-generator";
import { CANVAS_H, CANVAS_W, mmToPx, SAFE_H } from "@/lib/keytag-shape";

export const QR_PANEL_WIDTH_RATIO = 0.32;

/**
 * Error correction. Deliberately NOT "H": every step up adds modules, and at a
 * fixed physical size more modules means each one is smaller. On a ~15mm code
 * that trade is a net loss. "Q" still recovers ~25%.
 */
const QR_ECC_LEVEL = "Q" as const;

/**
 * Hard floor. Set to match the reference tags, whose codes measure ~8mm.
 * Small codes are a real scan risk on a domed surface — the UI warns when the
 * module size drops below 0.5mm rather than blocking it.
 */
export const QR_MIN_MM = 6;
export const QR_DEFAULT_MM = 15;

/** ISO 18004 requires 4 clear modules around the code. */
const QUIET_ZONE_MODULES = 4;

/** Halo opacity — enough to give the scanner an edge, faint enough to keep the artwork. */
const QUIET_ZONE_ALPHA = 0.62;

export const QR_MIN_PX = mmToPx(QR_MIN_MM);
export const QR_MAX_PX = SAFE_H;
export const QR_DEFAULT_PX = mmToPx(QR_DEFAULT_MM);

/** Right-hand side, vertically centred — roughly where the old panel sat. */
export function qrDefaultCenter(size = QR_DEFAULT_PX) {
  return {
    x: CANVAS_W - mmToPx(1) - size / 2,
    y: CANVAS_H / 2,
  };
}

export function clampQrSize(size: number) {
  return Math.max(QR_MIN_PX, Math.min(QR_MAX_PX, size));
}

/** Physical size of one module, in mm. Under ~0.5 is where scanning gets unreliable. */
export function qrModuleSizeMm(url: string, sizePx: number) {
  const trimmed = url.trim();
  if (!trimmed) return 0;
  const qr = qrcodeGenerator(0, QR_ECC_LEVEL);
  qr.addData(trimmed);
  qr.make();
  return sizePx / qr.getModuleCount() / mmToPx(1);
}

function relativeLuminance(hex: string) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Free-floating QR — no backing panel. With halo on, the quiet zone is a soft
 * glow of the opposite tone rather than a hard white box. With halo off the
 * artwork shows through completely between the modules, which is what the
 * reference tags do — scan reliability then rests entirely on the artwork
 * behind it being plain enough.
 */
export function drawQr(
  ctx: CanvasRenderingContext2D,
  url: string,
  centerX: number,
  centerY: number,
  size: number,
  color: string,
  halo = true
) {
  const trimmed = url.trim();
  if (!trimmed) return;

  const qrSize = clampQrSize(size);

  const qr = qrcodeGenerator(0, QR_ECC_LEVEL);
  qr.addData(trimmed);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const moduleSize = qrSize / moduleCount;
  const quiet = moduleSize * QUIET_ZONE_MODULES;

  const left = centerX - qrSize / 2;
  const top = centerY - qrSize / 2;

  if (halo) {
    // Light behind dark modules, dark behind light ones.
    const haloIsLight = relativeLuminance(color) < 0.5;
    const haloColor = haloIsLight ? "255,255,255" : "0,0,0";

    ctx.save();
    ctx.globalAlpha = QUIET_ZONE_ALPHA;
    ctx.fillStyle = `rgb(${haloColor})`;
    ctx.shadowColor = `rgba(${haloColor},${QUIET_ZONE_ALPHA})`;
    ctx.shadowBlur = moduleSize * 3;
    roundedRect(ctx, left - quiet, top - quiet, qrSize + quiet * 2, qrSize + quiet * 2, quiet);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = color;
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(
          left + col * moduleSize,
          top + row * moduleSize,
          moduleSize + 0.5,
          moduleSize + 0.5
        );
      }
    }
  }
  ctx.restore();
}

/** @deprecated Old fixed black panel. Removed once the new path is confirmed. */
export function drawQrPanel(
  ctx: CanvasRenderingContext2D,
  url: string,
  panelX: number,
  panelY: number,
  panelWidth: number,
  panelHeight: number
) {
  const trimmed = url.trim();
  if (!trimmed) return;

  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.restore();

  const qr = qrcodeGenerator(0, "H");
  qr.addData(trimmed);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const marginPx = Math.round(Math.min(panelWidth, panelHeight) * 0.08);
  const qrSizePx = Math.min(panelWidth, panelHeight) - marginPx * 2;
  const qrX = panelX + (panelWidth - qrSizePx) / 2;
  const qrY = panelY + (panelHeight - qrSizePx) / 2;
  const moduleSize = qrSizePx / moduleCount;

  ctx.save();
  ctx.fillStyle = "#ffffff";
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(qrX + col * moduleSize, qrY + row * moduleSize, moduleSize + 0.5, moduleSize + 0.5);
      }
    }
  }
  ctx.restore();
}