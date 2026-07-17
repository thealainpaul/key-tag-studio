import qrcodeGenerator from "qrcode-generator";

/**
 * The QR panel occupies this fraction of the design canvas width, anchored
 * to the right (wide) end of the tag - the left side tapers down for the
 * key-ring hole, so the QR must not be placed there or it risks clipping.
 */
export const QR_PANEL_WIDTH_RATIO = 0.32;

/**
 * Draws a solid black panel with white (reversed) QR modules on top,
 * matching the reference physical sample (BIK asked for majority-black
 * look, not a semi-transparent overlay on the customer's photo).
 *
 * Error correction is set to "H" (~30% recovery) to help offset the lower
 * scan reliability of a light-on-dark QR code versus the standard
 * dark-on-light scheme - validate with a real phone camera before use.
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
