import type { Quad } from "@/lib/mockup-quad";

/** Cropped photo of the top tag only (1024×266). */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1024,
  height: 266,
};

/**
 * Full recessed print area on the photo (pic + QR), as a quad in photo pixels.
 * Left edge tilts down slightly to match the tag perspective (see user screenshot).
 */
export const MOCKUP_ART_QUAD: Quad = {
  tl: { x: 340, y: 81 },
  tr: { x: 811, y: 80 },
  br: { x: 813, y: 262 },
  bl: { x: 324, y: 264 },
};
