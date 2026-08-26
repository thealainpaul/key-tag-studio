"use client";

import { useEffect, useRef, type RefObject, type MutableRefObject } from "react";
import {
  MOCKUP_CANVAS_PAD_BOTTOM,
  MOCKUP_FACE,
  MOCKUP_PHOTO,
  MOCKUP_PHOTO_OFFSET_Y,
} from "@/lib/mockup-layout";
import { CANVAS_H, CANVAS_W } from "@/lib/keytag-shape";

type Props = {
  contentCanvasRef: RefObject<HTMLCanvasElement | null>;
  active: boolean;
  revision: number;
  title?: string;
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

  function paint() {
    const output = localRef.current;
    const content = contentCanvasRef.current;
    const photo = photoRef.current;
    if (!output || !content || !photo || !photoReadyRef.current) return;

    const { width: pw, height: ph } = MOCKUP_PHOTO;
    const dy = MOCKUP_PHOTO_OFFSET_Y;

    output.width = pw;
    output.height = ph + MOCKUP_CANVAS_PAD_BOTTOM;

    const ctx = output.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, output.width, output.height);

    // The content canvas is TAG-SIZED (CANVAS_W x CANVAS_H) - the bleed ring
    // lives on the separate border canvas - so the whole of it is drawn here.
    //
    // Do NOT offset this by BLEED_PX. That would read past the edge of the
    // canvas and shift the artwork. The offset is only correct for the
    // bleed-sized layers.
    const srcX = 0;
    const srcY = 0;
    const srcW = CANVAS_W;
    const srcH = CANVAS_H;

    // ONE uniform scale for both axes, so nothing is stretched — the QR stays
    // square. Large enough to cover the face; the overhang is trimmed below.
    const s = Math.max(MOCKUP_FACE.w / srcW, MOCKUP_FACE.h / srcH);
    const w = srcW * s;
    const h = srcH * s;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      content,
      srcX,
      srcY,
      srcW,
      srcH,
      MOCKUP_FACE.x + (MOCKUP_FACE.w - w) / 2,
      MOCKUP_FACE.y + dy + (MOCKUP_FACE.h - h) / 2,
      w,
      h
    );

    // The metal goes on top. The face is transparent in the photo, so the
    // artwork shows through it exactly and cannot spill onto the metal.
    ctx.drawImage(photo, 0, dy, pw, ph);
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
