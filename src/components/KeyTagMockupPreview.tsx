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

    const nCols = MOCKUP_FACE_TOP.length;
    if (nCols < 2) return;

    // Clip to the measured face for the whole operation, so nothing drawn
    // below can reach the metal even by a fraction of a pixel.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(MOCKUP_FACE_X0, MOCKUP_FACE_TOP[0] + photoDy);
    for (let i = 1; i < nCols; i++) {
      ctx.lineTo(MOCKUP_FACE_X0 + i, MOCKUP_FACE_TOP[i] + photoDy);
    }
    for (let i = nCols - 1; i >= 0; i--) {
      ctx.lineTo(MOCKUP_FACE_X0 + i, MOCKUP_FACE_BOTTOM[i] + photoDy);
    }
    ctx.closePath();
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
        const destTop = MOCKUP_FACE_TOP[i];
        const destBottom = MOCKUP_FACE_BOTTOM[i];
        const destH = destBottom - destTop;
        if (destH <= 0) continue;

        const sxCentre = Math.min(CANVAS_W - 1, Math.round((i / (nCols - 1)) * (CANVAS_W - 1)));
        const sTop = tagCols.top[sxCentre];
        const sBottom = tagCols.bottom[sxCentre];
        if (sTop < 0 || sBottom <= sTop) continue;

        // Inset the source a pixel top and bottom so filtering cannot pull in
        // the transparent edge of the tapered shape.
        const sy = sTop + 1;
        const sh = Math.max(1, sBottom - sTop - 1);

        // Overdraw a pixel beyond the face; the clip above trims it exactly.
        ctx.drawImage(
          src,
          sxCentre,
          sy,
          1,
          sh,
          MOCKUP_FACE_X0 + i,
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
