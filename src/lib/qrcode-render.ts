import qrcodeGenerator from "qrcode-generator";

export const QR_PANEL_WIDTH_RATIO = 0.32;

/**
 * Solid black panel with white/reversed QR modules on top, anchored to the
 * right (wide) end of the tag. Error correction set to H (~30% recovery)
 * to offset the reduced scan reliability of a reversed colour scheme —
 * validate with a real phone camera before use.
 */
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
