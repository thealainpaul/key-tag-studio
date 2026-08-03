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
 * Top and bottom of the tag outline at a given canvas column, in canvas pixels.
 *
 * Read from a one-off render of the outline rather than derived by hand, so it
 * always agrees with drawGeometry — including the rounded right-hand corners.
 */
function measureTagColumns(insetMm: number): { top: Float32Array; bottom: Float32Array } | null {
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
  const top = new Float32Array(CANVAS_W);
  const bottom = new Float32Array(CANVAS_W);

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
  const tagColsRef = useRef<{ top: Float32Array; bottom: Float32Array } | null>(null);

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

  /** The design canvas masked to the printable area — inside the red band. */
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

    if (!tagColsRef.current) {
      tagColsRef.current = measureTagColumns(PRINTABLE_INSET_MM);
    }
    const tagCols = tagColsRef.current;
    if (!tagCols) return;

    const src = printableSource(content);
    if (!src) return;

    const nCols = MOCKUP_FACE_TOP.length;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // One strip per destination column. Each strip takes the tag's own slice at
    // the matching position and stretches it to the real opening measured from
    // the photo — so perspective and rounded corners are reproduced exactly.
    for (let i = 0; i < nCols; i++) {
      const destTop = MOCKUP_FACE_TOP[i];
      const destBottom = MOCKUP_FACE_BOTTOM[i];
      const destH = destBottom - destTop;
      if (destH <= 0) continue;

      const sxCentre = Math.min(CANVAS_W - 1, Math.round((i / (nCols - 1)) * (CANVAS_W - 1)));
      const sTop = tagCols.top[sxCentre];
      const sBottom = tagCols.bottom[sxCentre];
      if (sTop < 0 || sBottom <= sTop) continue;

      const sw = Math.max(1, CANVAS_W / nCols);

      ctx.drawImage(
        src,
        Math.max(0, sxCentre - sw / 2),
        sTop,
        sw,
        sBottom - sTop + 1,
        MOCKUP_FACE_X0 + i,
        destTop + photoDy,
        1.5,
        destH + 1
      );
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
