/** Cropped photo of the top tag only (1024×288). Bottom rows padded so the tag corner is not cut. */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1024,
  height: 288,
};

/**
 * Shift photo up so the tag has equal black margin top and bottom.
 * Tag pixel coords in the file are unchanged from the working version.
 */
export const MOCKUP_PHOTO_OFFSET_Y = -34;

/** Canvas taller than the photo so the centred tag has room below. */
export const MOCKUP_CANVAS_PAD_BOTTOM = 36;

/** Full recess (pic + QR) — unchanged from the working version. */
export const MOCKUP_ART_PIXELS = {
  x: 327,
  y: 77,
  w: 484,
  h: 188,
};

/** Counter-clockwise around bottom-right — drops the left edge down. */
export const MOCKUP_ROTATE_RAD = -0.032;
