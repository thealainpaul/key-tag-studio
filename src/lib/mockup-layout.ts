/** Cropped photo of the top tag only (1024×266). */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1024,
  height: 266,
};

/**
 * Full recessed print area on the photo (image + QR), in pixels.
 * Measured on keytag-mockup-top.png — aspect ≈ 2.47 vs design canvas ≈ 2.31.
 * Pic-only (left of QR) is ~52% of width and aspect ≈ 1.29 — too narrow for the red frame.
 */
export const MOCKUP_ART_PIXELS = {
  x: 336,
  y: 82,
  w: 468,
  h: 186,
};

/** Pic-only sub-region (sample face), for reference / future QR split UI. */
export const MOCKUP_PIC_ONLY_PIXELS = {
  x: 344,
  y: 84,
  w: 239,
  h: 180,
};
