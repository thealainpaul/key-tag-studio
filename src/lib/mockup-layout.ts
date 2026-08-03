/** Cropped photo of the top tag only (1024×284), straight from the product mockup. */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1024,
  height: 284,
};

/** Unchanged from the working version. */
export const MOCKUP_PHOTO_OFFSET_Y = -34;
export const MOCKUP_CANVAS_PAD_BOTTOM = 36;

/**
 * Where the design canvas lands on the photo.
 *
 * MEASURED, not estimated. The printed insert was isolated as the hole in the
 * metal body of keytag-mockup-top.png, and its top and bottom edges fitted:
 *
 *   insert spans x 339..810
 *   top edge     y = -0.07104x + 141.08
 *   bottom edge  y =  0.05651x + 214.44
 *   height at left 116.6px, at right 176.7px  -> ratio 0.660
 *
 * The real tag's left edge is 14.0mm against 19.9mm at the right - ratio 0.704.
 * The photo shows 0.660, so the tag is foreshortened by perspective, roughly 6%
 * at the far end. A scale-and-rotate transform can only produce a parallelogram,
 * never a trapezoid, which is why the mockup never matched the editor no matter
 * how x/y/w/h were adjusted.
 *
 * The quad below is the destination for the four corners of the DESIGN CANVAS
 * (not the tag outline). The left pair is extrapolated along the measured left
 * edge from the tag's own left edge, which sits at canvas y 140..801:
 *
 *   scale along left edge = 116.6 / 661 = 0.176399 px per canvas px
 *   canvas y=0   -> 117.0 - 140 x 0.176399 = 92.30
 *   canvas y=940 -> 117.0 + 800 x 0.176399 = 258.12
 *
 * Coordinates are in the photo's own pixel space; the paint code adds
 * MOCKUP_PHOTO_OFFSET_Y when drawing.
 */
export const MOCKUP_ART_QUAD = {
  topLeft: { x: 339, y: 92.3 },
  topRight: { x: 810, y: 83.53 },
  bottomRight: { x: 810, y: 260.21 },
  bottomLeft: { x: 339, y: 258.12 },
};

/**
 * Kept for anything still importing it. Derived from the quad's bounding box -
 * do not use it for placement, it cannot represent the perspective.
 *
 * @deprecated use MOCKUP_ART_QUAD
 */
export const MOCKUP_ART_PIXELS = {
  x: 339,
  y: 83,
  w: 471,
  h: 177,
};

/** @deprecated rotation is carried by MOCKUP_ART_QUAD */
export const MOCKUP_ROTATE_RAD = 0;
