import type { DesignImage } from "@/lib/design";

export function pointerDistance(pointers: Map<number, { x: number; y: number }>): number {
  const pts = [...pointers.values()];
  if (pts.length < 2) return 0;
  return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
}

export function touchDistance(touches: TouchList | React.TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.hypot(dx, dy);
}

/** Scale image uniformly around its center — proportions stay correct. */
export function scaleImageUniform(img: DesignImage, factor: number): DesignImage {
  const cx = img.x + img.width / 2;
  const cy = img.y + img.height / 2;
  const width = img.width * factor;
  const height = img.height * factor;
  return { ...img, x: cx - width / 2, y: cy - height / 2, width, height };
}

export type PinchState = {
  id: string;
  startDist: number;
  startW: number;
  startH: number;
  cx: number;
  cy: number;
};

export function pinchImageDimensions(pinch: PinchState, currentDist: number) {
  const scale = currentDist / pinch.startDist;
  const width = pinch.startW * scale;
  const height = pinch.startH * scale;
  return {
    x: pinch.cx - width / 2,
    y: pinch.cy - height / 2,
    width,
    height,
  };
}
