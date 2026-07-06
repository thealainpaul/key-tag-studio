"use client";

import { useEffect, useRef, type RefObject } from "react";
import { CANVAS_H, CANVAS_W } from "@/lib/keytag-shape";
import { MOCKUP_ART_QUAD, MOCKUP_PHOTO } from "@/lib/mockup-layout";
import { drawImageInQuad } from "@/lib/mockup-quad";

type Props = {
  contentCanvasRef: RefObject<HTMLCanvasElement | null>;
  active: boolean;
  revision: number;
};

export default function KeyTagMockupPreview({ contentCanvasRef, active, revision }: Props) {
  const outputRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<HTMLImageElement | null>(null);
  const photoReadyRef = useRef(false);

  useEffect(() => {
    const img = new Image();
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
    const output = outputRef.current;
    const content = contentCanvasRef.current;
    const photo = photoRef.current;
    if (!output || !content || !photo || !photoReadyRef.current) return;

    const { width: pw, height: ph } = MOCKUP_PHOTO;
    output.width = pw;
    output.height = ph;

    const ctx = output.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, pw, ph);
    ctx.drawImage(photo, 0, 0, pw, ph);
    drawImageInQuad(ctx, content, CANVAS_W, CANVAS_H, MOCKUP_ART_QUAD);
  }

  useEffect(() => {
    if (!active) return;
    paint();
  }, [active, contentCanvasRef, revision]);

  if (!active) return null;

  return (
    <div className="tag-mockup-panel">
      <p className="tag-mockup-title">How it will look on your key tag</p>
      <div className="tag-mockup-crop">
        <canvas ref={outputRef} className="tag-mockup-canvas" width={MOCKUP_PHOTO.width} height={MOCKUP_PHOTO.height} />
      </div>
    </div>
  );
}
