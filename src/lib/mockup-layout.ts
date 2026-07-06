/** Cropped photo of the top tag only (1024×266). */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1024,
  height: 266,
};

/** Visible tag bounds in the photo file (measured pixels). */
export const MOCKUP_TAG_BOUNDS = {
  left: 192,
  top: 70,
  right: 817,
  bottom: 265,
};

/** Equal black padding around the tag in the preview canvas. */
export const MOCKUP_FRAME_PAD = 20;

/** Full recess (pic + QR) on the product photo, in photo pixel coords. */
export const MOCKUP_ART_PIXELS = {
  x: 327,
  y: 77,
  w: 484,
  h: 188,
};

/** Counter-clockwise around bottom-right — drops the left edge down. */
export const MOCKUP_ROTATE_RAD = -0.032;

export function mockupCanvasSize() {
  const b = MOCKUP_TAG_BOUNDS;
  const p = MOCKUP_FRAME_PAD;
  return {
    width: b.right - b.left + 1 + 2 * p,
    height: b.bottom - b.top + 1 + 2 * p,
  };
}

export function mockupPhotoOrigin() {
  const b = MOCKUP_TAG_BOUNDS;
  const p = MOCKUP_FRAME_PAD;
  return { x: p - b.left, y: p - b.top };
}
