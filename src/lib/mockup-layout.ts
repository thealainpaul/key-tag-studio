/**
 * The tag photo. The printed face has been punched out of it — that region is
 * fully transparent — so the metal can be laid OVER the artwork and trim it to
 * the exact opening. Nothing in the code needs to describe the tag's shape.
 */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1024,
  height: 284,
};

export const MOCKUP_PHOTO_OFFSET_Y = -34;
export const MOCKUP_CANVAS_PAD_BOTTOM = 36;

/** Bounding box of the punched-out face, in photo pixels. Measured from the asset. */
export const MOCKUP_FACE = { x: 340, y: 76, w: 470, h: 198 };
