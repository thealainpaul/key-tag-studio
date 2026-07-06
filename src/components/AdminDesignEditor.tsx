"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";
import {
  drawBorderLayer,
  drawContentLayer,
  downloadDataUrl,
  mergedPreviewDataUrl,
  preloadAllImages,
  printFileDataUrl,
} from "@/lib/canvas-render";
import { scaleImageUniform } from "@/lib/canvas-gestures";
import { useCanvasGestures } from "@/hooks/useCanvasGestures";
import { CANVAS_H, CANVAS_W } from "@/lib/keytag-shape";

type Props = {
  designId: string;
  initialPayload: DesignPayload;
  initialStatus: string;
};

export default function AdminDesignEditor({ designId, initialPayload, initialStatus }: Props) {
  const contentCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewStackRef = useRef<HTMLDivElement>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const imagesRef = useRef<DesignImage[]>(initialPayload.images);
  const textLinesRef = useRef<TextLine[]>(initialPayload.textLines);
  const selectedBgIdRef = useRef<string | null>(initialPayload.backgroundImageId);
  const tagColorRef = useRef(initialPayload.tagColor);

  const [tagColor, setTagColor] = useState(initialPayload.tagColor);
  const [images, setImages] = useState<DesignImage[]>(initialPayload.images);
  const [textLines, setTextLines] = useState<TextLine[]>(initialPayload.textLines);
  const [selectedBgId, setSelectedBgId] = useState<string | null>(initialPayload.backgroundImageId);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  imagesRef.current = images;
  textLinesRef.current = textLines;
  selectedBgIdRef.current = selectedBgId;
  tagColorRef.current = tagColor;

  const redrawContent = useCallback(
    (nextImages = imagesRef.current, nextTextLines = textLinesRef.current, color = tagColor) => {
      const canvas = contentCanvasRef.current;
      if (!canvas) return;
      drawContentLayer(canvas, color, nextImages, nextTextLines, imageCache.current);
    },
    [tagColor]
  );

  useEffect(() => {
    (async () => {
      await preloadAllImages(initialPayload.images, imageCache.current);
      setReady(true);
      const border = borderCanvasRef.current;
      if (border) drawBorderLayer(border);
      redrawContent();
    })();
  }, [initialPayload, redrawContent]);

  useEffect(() => {
    if (ready) redrawContent();
  }, [tagColor, images, textLines, ready, redrawContent]);

  useCanvasGestures({
    canvasRef: contentCanvasRef,
    touchTargetRef: previewStackRef,
    enabled: ready,
    imagesRef,
    textLinesRef,
    selectedBgIdRef,
    tagColorRef,
    redrawContent,
    onImagesChange: setImages,
    onTextLinesChange: setTextLines,
  });

  function scaleActiveImage(factor: number) {
    const id = selectedBgId || images[0]?.id;
    if (!id) return;
    setImages((prev) => prev.map((img) => (img.id === id ? scaleImageUniform(img, factor) : img)));
  }

  function currentPayload(): DesignPayload {
    return { tagColor, images, textLines, backgroundImageId: selectedBgId, fitMode: initialPayload.fitMode };
  }

  async function save() {
    const content = contentCanvasRef.current;
    const border = borderCanvasRef.current;
    if (!content || !border) return;

    const previewDataUrl = mergedPreviewDataUrl(content, border);
    const res = await fetch(`/api/admin/designs/${designId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designJson: currentPayload(), previewDataUrl }),
    });
    const data = await res.json();
    setMessage(data.success ? "Saved." : data.error || "Save failed");
  }

  function downloadPrint() {
    const dataUrl = printFileDataUrl(currentPayload(), imageCache.current);
    downloadDataUrl(dataUrl, `keytag-print-${designId}.png`);
  }

  return (
    <div className="container">
      <div className="nav">
        <Link href="/admin/designs">← Back</Link>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="btn secondary" onClick={downloadPrint}>Download print file</button>
          <button className="btn" onClick={save}>Save adjustments</button>
        </div>
      </div>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Status: {initialStatus}
          {initialPayload.fitMode === "auto" && " · Customer chose auto-fit — adjust image before printing."}
        </p>

        <div className="preview-panel" style={{ marginBottom: "1rem" }}>
          <div className="preview-wrap">
            <div className="preview-stack" ref={previewStackRef}>
              <canvas
                ref={contentCanvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="preview-content"
                style={{ touchAction: "none" }}
              />
              <canvas ref={borderCanvasRef} width={CANVAS_W} height={CANVAS_H} className="preview-border" aria-hidden="true" />
            </div>
          </div>
          {images.length > 0 && (
            <>
              <p className="muted" style={{ textAlign: "center", margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
                Drag to move · Pinch to resize (or use − +)
              </p>
              <div className="image-scale-bar">
                <button type="button" className="btn secondary compact" onClick={() => scaleActiveImage(0.9)} aria-label="Smaller">−</button>
                <span className="muted">Image size</span>
                <button type="button" className="btn secondary compact" onClick={() => scaleActiveImage(1.1)} aria-label="Larger">+</button>
              </div>
            </>
          )}
        </div>

        <div className="field">
          <label>Tag color</label>
          <input type="color" value={tagColor} onChange={(e) => setTagColor(e.target.value)} />
        </div>

        {images.length > 1 && (
          <div className="field">
            <label>Background image</label>
            <select value={selectedBgId || ""} onChange={(e) => setSelectedBgId(e.target.value || null)}>
              {images.map((img, i) => (
                <option key={img.id} value={img.id}>Image {i + 1}</option>
              ))}
            </select>
          </div>
        )}

        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
}
