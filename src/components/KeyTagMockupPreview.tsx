"use client";

import { useEffect, useRef, type RefObject, type MutableRefObject } from "react";
import { CANVAS_H, CANVAS_W, getTagMetrics, PRINTABLE_INSET_MM } from "@/lib/keytag-shape";
import {
  MOCKUP_ART_QUAD,
  MOCKUP_CANVAS_PAD_BOTTOM,
  MOCKUP_PHOTO,
  MOCKUP_PHOTO_OFFSET_Y,
} from "@/lib/mockup-layout";

type Props = {
  contentCanvasRef: RefObject<HTMLCanvasElement | null>;
  active: boolean;
  revision: number;
  title?: string;
  /** Optional: lets the parent read this canvas, e.g. to save the mockup. */
  outputRef?: MutableRefObject<HTMLCanvasElement | null>;
};

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

  /**
   * The design canvas, masked to the printable area — everything inside the
   * inner edge of the red guide band. This is exactly what the editor promises
   * will be printed, so the mockup mirrors it.
   */
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

    const src = printableSource(content);
    if (!src) return;

    const q = MOCKUP_ART_QUAD;
    const xL = q.topLeft.x;
    const xR = q.topRight.x;
    const spanX = xR - xL;
    if (spanX <= 0) return;

    // The tag is foreshortened in the photo, so the destination is a trapezoid.
    // Canvas 2D cannot draw one directly, so the artwork is drawn as vertical
    // strips, each scaled to the exact height of the trapezoid at that column.
    // At one strip per destination pixel the error is below half a pixel.
    const strips = Math.ceil(spanX);
    const srcStep = CANVAS_W / spanX;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    for (let i = 0; i < strips; i++) {
      const t0 = i / spanX;
      const t1 = Math.min(1, (i + 1) / spanX);
      const tMid = (t0 + t1) / 2;

      const topY = q.topLeft.y + (q.topRight.y - q.topLeft.y) * tMid;
      const botY = q.bottomLeft.y + (q.bottomRight.y - q.bottomLeft.y) * tMid;
      const h = botY - topY;
      if (h <= 0) continue;

      const sx = tMid * CANVAS_W - srcStep / 2;
      const sw = srcStep;

      // Overlap each strip by a pixel so no seam shows between them.
      ctx.drawImage(
        src,
        Math.max(0, sx),
        0,
        Math.max(1, sw),
        CANVAS_H,
        xL + i,
        topY + photoDy,
        1.5,
        h
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
