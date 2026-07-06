/** Cropped photo of the top tag only (1024×266). */
export const MOCKUP_PHOTO = {
  src: "/keytag-mockup-top.png",
  width: 1024,
  height: 266,
};

/**
 * Recessed print area on the product photo (left of QR), as fractions of photo size.
 * Measured from keytag-mockup-top.png pixels:
 *   left ≈ 337px, top ≈ 107px, right ≈ 632px (QR edge), bottom ≈ 253px
 */
export const MOCKUP_ART_WINDOW = {
  left: 337 / 1024,
  top: 107 / 266,
  width: (632 - 337) / 1024,
  height: (253 - 107) / 266,
};

/** Trapezoid clip matching the key-tag print shape (46 mm × 19.9 mm, 14 mm left height). */
const leftInset = ((19.9 - 14) / 2 / 19.9) * 100;
export const MOCKUP_CLIP_PATH = `polygon(0% ${leftInset}%, 100% 0%, 100% 100%, 0% ${100 - leftInset}%)`;
