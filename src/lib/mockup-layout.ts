import type { Quad } from "@/lib/mockup-quad";

/** Cropped photo of the top tag only (1024×266). */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1024,
  height: 266,
};

/**
 * Photo recess quad (pic + QR), measured on keytag-mockup-top.png.
 * Green calibration overlay — left edge slopes right toward the bottom.
 */
export const MOCKUP_ART_QUAD: Quad = {
  tl: { x: 330, y: 76 },
  tr: { x: 813, y: 76 },
  br: { x: 815, y: 266 },
  bl: { x: 349, y: 267 },
};
