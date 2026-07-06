/** Cropped photo of the top tag only (1024×266). */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1024,
  height: 266,
};

/**
 * Full recess (pic + QR) measured on keytag-mockup-top.png, plus 2px bleed.
 * Green calibration: tl 332,79 → br 813,263; left edge slopes ~16px right at bottom.
 */
export const MOCKUP_ART_PIXELS = {
  x: 330,
  y: 77,
  w: 485,
  h: 190,
};

/** Tiny skew so the left edge tilts down to match the photo recess. */
export const MOCKUP_LEFT_SKEW = 0.042;
