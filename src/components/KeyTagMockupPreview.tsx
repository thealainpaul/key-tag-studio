"use client";

import { useEffect, useState, type RefObject } from "react";
import { MOCKUP_ART_WINDOW, MOCKUP_PHOTO } from "@/lib/mockup-layout";

type Props = {
  contentCanvasRef: RefObject<HTMLCanvasElement | null>;
  active: boolean;
  revision: number;
};

export default function KeyTagMockupPreview({ contentCanvasRef, active, revision }: Props) {
  const [artSrc, setArtSrc] = useState("");

  useEffect(() => {
    const canvas = contentCanvasRef.current;
    if (!active || !canvas) {
      setArtSrc("");
      return;
    }
    setArtSrc(canvas.toDataURL("image/png"));
  }, [active, contentCanvasRef, revision]);

  if (!active || !artSrc) return null;

  const win = MOCKUP_ART_WINDOW;

  return (
    <div className="tag-mockup-panel">
      <p className="tag-mockup-title">How it will look on your key tag</p>
      <div className="tag-mockup-crop">
        <div
          className="tag-mockup-viewport"
          style={{ paddingBottom: `${MOCKUP_PHOTO.viewportPaddingPercent}%` }}
        >
          <img
            src={MOCKUP_PHOTO.src}
            alt="Key tag product"
            className="tag-mockup-photo"
            draggable={false}
          />
          <div
            className="tag-mockup-art"
            style={{
              left: `${win.left * 100}%`,
              top: `${win.top * 100}%`,
              width: `${win.width * 100}%`,
              height: `${win.height * 100}%`,
            }}
          >
            <img src={artSrc} alt="Your design on the tag" className="tag-mockup-art-img" draggable={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
