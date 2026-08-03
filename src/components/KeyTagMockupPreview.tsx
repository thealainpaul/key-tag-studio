"use client";

import { useEffect, useRef, type RefObject, type MutableRefObject } from "react";
import { CANVAS_H, CANVAS_W, getTagMetrics, PRINTABLE_INSET_MM } from "@/lib/keytag-shape";
import {
  MOCKUP_CANVAS_PAD_BOTTOM,
  MOCKUP_FACE_BOTTOM,
  MOCKUP_FACE_TOP,
  MOCKUP_FACE_X0,
  MOCKUP_PHOTO,
  MOCKUP_PHOTO_OFFSET_Y,
} from "@/lib/mockup-layout";

type Props = {
  contentCanvasRef: RefObject<HTMLCanvasElement | null>;
  active: boolean;
  revision: number;
  title?: string;
  outputRef?: MutableRefObject<HTMLCanvasElement | null>;
};


/**
 * Find the tag's printed face in the photo, at runtime.
 *
 * Measured from the image the browser actually loaded, so it cannot go stale
 * against a hardcoded table if the artwork file is ever changed or replaced.
 *
 * Metal is bright, mildly warm and NOT strongly saturated - that last part
 * keeps printed colours out of the metal class. For each column the face is the
 * gap between the upper and lower metal bands.
 */
function measureFaceFromPhoto(photo: HTMLImageElement): {
  x0: number;
  top: Int16Array;
  bottom: Int16Array;
} | null {
  if (typeof document === "undefined") return null;

  const w = photo.naturalWidth || MOCKUP_PHOTO.width;
  const h = photo.naturalHeight || MOCKUP_PHOTO.height;

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(photo, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }

  const isMetal = (x: number, y: number) => {
    const o = (y * w + x) * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const lum = (r + g + b) / 3;
    const rb = r - b;
    return rb > 12 && rb < 95 && lum > 78 && g > b && Math.abs(r - g) < 70;
  };

  const top = new Int16Array(w).fill(-1);
  const bottom = new Int16Array(w).fill(-1);

  for (let x = 0; x < w; x++) {
    let firstMetal = -1;
    let lastMetal = -1;
    for (let y = 0; y < h; y++) {
      if (isMetal(x, y)) {
        if (firstMetal < 0) firstMetal = y;
        lastMetal = y;
      }
    }
    if (firstMetal < 0) continue;

    // End of the FIRST metal band from the top, and start of the LAST metal
    // band from the bottom. Taking the outermost bands means printed colours
    // inside the face that happen to look metallic - skin tones, pale QR - are
    // ignored instead of cutting the face short.
    let y = firstMetal;
    while (y < h && isMetal(x, y)) y++;
    const faceTop = y;

    let y2 = lastMetal;
    while (y2 >= 0 && isMetal(x, y2)) y2--;
    const faceBottom = y2;

    if (faceBottom - faceTop > 15) {
      top[x] = faceTop;
      bottom[x] = faceBottom;
    }
  }

  // widest continuous run of valid columns
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  for (let x = 0; x <= w; x++) {
    const ok = x < w && top[x] >= 0;
    if (ok && runStart < 0) runStart = x;
    if (!ok && runStart >= 0) {
      if (x - runStart > bestLen) {
        bestLen = x - runStart;
        bestStart = runStart;
      }
      runStart = -1;
    }
  }
  if (bestLen < 40) return null;

  // grow by 2px: lapping onto the dark rim is invisible, falling short is not
  const outTop = new Int16Array(bestLen);
  const outBottom = new Int16Array(bestLen);
  for (let i = 0; i < bestLen; i++) {
    outTop[i] = top[bestStart + i] - 2;
    outBottom[i] = bottom[bestStart + i] + 2;
  }

  return { x0: bestStart, top: outTop, bottom: outBottom };
}

/** Top and bottom of the tag outline at each canvas column. */
function measureTagColumns(insetMm: number): { top: Int16Array; bottom: Int16Array } | null {
  if (typeof document === "undefined") return null;

  const c = document.createElement("canvas");
  c.width = CANVAS_W;
  c.height = CANVAS_H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  const metrics = getTagMetrics(CANVAS_W, CANVAS_H);
  metrics.drawGeometry(ctx, insetMm);
  ctx.fillStyle = "#fff";
  ctx.fill();

  const data = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H).data;
  const top = new Int16Array(CANVAS_W);
  const bottom = new Int16Array(CANVAS_W);

  for (let x = 0; x < CANVAS_W; x++) {
    let t = -1;
    let b = -1;
    for (let y = 0; y < CANVAS_H; y++) {
      if (data[(y * CANVAS_W + x) * 4 + 3] > 8) {
        if (t < 0) t = y;
        b = y;
      }
    }
    top[x] = t;
    bottom[x] = b;
  }

  return { top, bottom };
}

export default function KeyTagMockupPreview({
  contentCanvasRef,
  active,
  revision,
  title,
  outputRef,
}: Props) {
  const localRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<HTMLImageElement | null>(null);
  const photoReadyRef = useRef(false);
  const tagColsRef = useRef<{ top: Int16Array; bottom: Int16Array } | null>(null);
  const faceRef = useRef<{ x0: number; top: Int16Array; bottom: Int16Array } | null>(null);

  useEffect(() => {
    if (outputRef) outputRef.current = localRef.current;
  });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      photoRef.current = img;
      photoReadyRef.current = true;
      if (active) paint();
    };
    img.src = MOCKUP_PHOTO.src;
    return () => {
      photoReadyRef.current = false;
      photoRef.current = null;
    };
  }, [active]);

  /** Design canvas masked to the printable area, on an opaque backing. */
  function printableSource(content: HTMLCanvasElement): HTMLCanvasElement | null {
    const off = document.createElement("canvas");
    off.width = CANVAS_W;
    off.height = CANVAS_H;
    const o = off.getContext("2d");
    if (!o) return null;

    const metrics = getTagMetrics(CANVAS_W, CANVAS_H);
    o.save();
    metrics.drawGeometry(o, PRINTABLE_INSET_MM);
    o.clip();
    o.fillStyle = "#000";
    o.fillRect(0, 0, CANVAS_W, CANVAS_H);
    o.drawImage(content, 0, 0);
    o.restore();
    return off;
  }

  function paint() {
    const output = localRef.current;
    const content = contentCanvasRef.current;
    const photo = photoRef.current;
    if (!output || !content || !photo || !photoReadyRef.current) return;

    const { width: pw, height: ph } = MOCKUP_PHOTO;
    const photoDy = MOCKUP_PHOTO_OFFSET_Y;
    const canvasH = ph + MOCKUP_CANVAS_PAD_BOTTOM;

    output.width = pw;
    output.height = canvasH;

    const ctx = output.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, pw, canvasH);
    ctx.drawImage(photo, 0, photoDy, pw, ph);

    if (!faceRef.current) {
      faceRef.current = measureFaceFromPhoto(photo);
    }
    const measured = faceRef.current;

    const faceX0 = measured ? measured.x0 : MOCKUP_FACE_X0;
    const faceTopArr: ArrayLike<number> = measured ? measured.top : MOCKUP_FACE_TOP;
    const faceBotArr: ArrayLike<number> = measured ? measured.bottom : MOCKUP_FACE_BOTTOM;
    const nCols = faceTopArr.length;

    // Opaque underlay across the whole face first. Nothing of the photo's own
    // printed image can show through, whatever the artwork does above it.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(faceX0, faceTopArr[0] + photoDy);
    for (let i = 1; i < nCols; i++) {
      ctx.lineTo(faceX0 + i, faceTopArr[i] + photoDy);
    }
    for (let i = nCols - 1; i >= 0; i--) {
      ctx.lineTo(faceX0 + i, faceBotArr[i] + photoDy);
    }
    ctx.closePath();
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.clip();

    if (!tagColsRef.current) {
      tagColsRef.current = measureTagColumns(PRINTABLE_INSET_MM);
    }
    const tagCols = tagColsRef.current;
    const src = printableSource(content);

    if (tagCols && src) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      for (let i = 0; i < nCols; i++) {
        const destTop = faceTopArr[i];
        const destBottom = faceBotArr[i];
        const destH = destBottom - destTop;
        if (destH <= 0) continue;

        const sxCentre = Math.min(CANVAS_W - 1, Math.round((i / (nCols - 1)) * (CANVAS_W - 1)));
        const sTop = tagCols.top[sxCentre];
        const sBottom = tagCols.bottom[sxCentre];
        if (sTop < 0 || sBottom <= sTop) continue;

        // Sample a single source column and inset it a pixel top and bottom, so
        // filtering cannot pull in the transparent edge of the tapered shape.
        const sy = sTop + 1;
        const sh = Math.max(1, sBottom - sTop - 1);

        ctx.drawImage(
          src,
          sxCentre,
          sy,
          1,
          sh,
          faceX0 + i,
          destTop + photoDy - 1,
          2,
          destH + 2
        );
      }
    }

    ctx.restore();
  }

  useEffect(() => {
    if (!active) return;
    paint();
  }, [active, contentCanvasRef, revision]);

  if (!active) return null;

  return (
    <div className="tag-mockup-panel">
      <p className="tag-mockup-title">{title || "How it will look on your key tag"}</p>
      <div className="tag-mockup-crop">
        <canvas ref={localRef} className="tag-mockup-canvas" />
      </div>
    </div>
  );
}
