/**
 * The tag photo. The printed face has been punched out of it — that region is
 * fully transparent — so the metal can be laid OVER the artwork and trim it to
 * the exact opening. Nothing in the code needs to describe the tag's shape.
 */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1882,
  height: 674,
};

/**
 * Vertical nudge, in asset pixels.
 *
 * ZERO for this asset. The old value existed to crop whitespace out of the
 * photograph; this asset is built from vector and is already tight to the tag
 * (body spans y 6..674 of 682), so any negative offset slices the top off.
 */
export const MOCKUP_PHOTO_OFFSET_Y = 0;

/** Breathing room under the tag in the emailed mockup. */
export const MOCKUP_CANVAS_PAD_BOTTOM = 40;

/**
 * Bounding box of the punched-out face, in asset pixels. Measured from the file.
 *
 * The asset is now BUILT from the manufacturer's vector outline rather than
 * photographed, so its face is his exact shape at 44.0 x 17.9 mm. The old
 * photograph disagreed with his drawing by 2.7% and that gap could never be
 * closed by adjusting anything else.
 *
 * The 1386 x 564 figure is deliberate, not measured. 2079/846 reduces to
 * 231/94, so any face that is a multiple of 231 x 94 has EXACTLY the canvas
 * ratio; 1386 x 564 is 6x. The face therefore differs from the artwork
 * proportion by 0.000000000000%, and the mockup scale lands on exactly 2/3,
 * so the artwork draws at 1386.0000 x 564.0000 with no fractional pixels.
 *
 * It is one pixel wider than the punched hole (1385) on purpose, so it covers
 * it; the metal on top trims the overhang.
 */
export const MOCKUP_FACE = { x: 442, y: 55, w: 1386, h: 564 };
