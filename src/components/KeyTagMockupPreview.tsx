"use client";

import { useEffect, useRef, type RefObject } from "react";
import { CANVAS_H, CANVAS_W, getTagMetrics } from "@/lib/keytag-shape";
import { MOCKUP_ART_PIXELS, MOCKUP_PHOTO, MOCKUP_ROTATE_RAD } from "@/lib/mockup-layout";

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

    const { x, y, w, h } = MOCKUP_ART_PIXELS;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, pw, ph);
    ctx.drawImage(photo, 0, 0, pw, ph);

    ctx.save();
    ctx.translate(x + w, y + h);
    ctx.rotate(MOCKUP_ROTATE_RAD);
    ctx.translate(-w, -h);
    ctx.scale(w / CANVAS_W, h / CANVAS_H);

    const metrics = getTagMetrics(CANVAS_W, CANVAS_H);
    metrics.drawGeometry(ctx);
    ctx.clip();
    ctx.drawImage(content, 0, 0);
    ctx.restore();
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
        <canvas ref={outputRef} className="tag-mockup-canvas" />
      </div>
    </div>
  );
}
