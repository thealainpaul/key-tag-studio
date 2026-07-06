import type { Quad } from "@/lib/mockup-quad";

/** Cropped photo of the top tag only (1024×266). */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1024,
  height: 266,
};

/**
 * Full recessed print area on the photo (pic + QR), as a quad in photo pixels.
 * Calibrated on keytag-mockup-top.png — left edge slopes slightly right toward the bottom.
 */
export const MOCKUP_ART_QUAD: Quad = {
  tl: { x: 333, y: 78 },
  tr: { x: 810, y: 78 },
  br: { x: 812, y: 264 },
  bl: { x: 347, y: 265 },
};
