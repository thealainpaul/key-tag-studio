/** Cropped photo of the top tag only (1024×266). */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1024,
  height: 266,
};

/**
 * Draw the full photo — never crop the tag out of the frame.
 * Shift photo up so the tag has equal black margin top and bottom.
 * (Tag sits y=70–265 in the file; was flush to the bottom edge.)
 */
export const MOCKUP_PHOTO_OFFSET_Y = -34;

/** Canvas taller than the photo so the centred tag has room below. */
export const MOCKUP_CANVAS_PAD_BOTTOM = 36;

/** Full recess (pic + QR) on the product photo, in photo pixel coords. */
export const MOCKUP_ART_PIXELS = {
  x: 327,
  y: 77,
  w: 484,
  h: 188,
};

/** Counter-clockwise around bottom-right — drops the left edge down. */
export const MOCKUP_ROTATE_RAD = -0.032;
