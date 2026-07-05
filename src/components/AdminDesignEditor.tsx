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
import { CANVAS_H, CANVAS_W } from "@/lib/keytag-shape";

type Props = {
  designId: string;
  initialPayload: DesignPayload;
  initialStatus: string;
};

export default function AdminDesignEditor({ designId, initialPayload, initialStatus }: Props) {
  const contentCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const imagesRef = useRef<DesignImage[]>(initialPayload.images);
  const textLinesRef = useRef<TextLine[]>(initialPayload.textLines);
  const dragRef = useRef<{ type: "text" | "image"; id: string; ox: number; oy: number } | null>(null);

  const [tagColor, setTagColor] = useState(initialPayload.tagColor);
  const [images, setImages] = useState<DesignImage[]>(initialPayload.images);
  const [textLines, setTextLines] = useState<TextLine[]>(initialPayload.textLines);
  const [selectedBgId, setSelectedBgId] = useState<string | null>(initialPayload.backgroundImageId);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  imagesRef.current = images;
  textLinesRef.current = textLines;

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

  function canvasPoint(clientX: number, clientY: number) {
    const canvas = contentCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }

  function beginDrag(clientX: number, clientY: number) {
    const ctx = contentCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    const bg = imagesRef.current.find((i) => i.id === selectedBgId) || imagesRef.current[0];
    const { x, y } = canvasPoint(clientX, clientY);

    const hitText = [...textLinesRef.current].reverse().find((line) => {
      if (!line.text.trim()) return false;
      ctx.font = `${line.fontSize}px "${line.fontFamily}"`;
      const w = ctx.measureText(line.text).width;
      const h = line.fontSize * 1.3;
      return x >= line.x - w / 2 - 16 && x <= line.x + w / 2 + 16 && y >= line.y - h / 2 - 16 && y <= line.y + h / 2 + 16;
    });

    if (hitText) {
      dragRef.current = { type: "text", id: hitText.id, ox: x - hitText.x, oy: y - hitText.y };
      return;
    }
    if (bg) {
      dragRef.current = { type: "image", id: bg.id, ox: x - bg.x, oy: y - bg.y };
    }
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragRef.current) return;
    const { x, y } = canvasPoint(clientX, clientY);
    if (dragRef.current.type === "text") {
      const next = textLinesRef.current.map((l) =>
        l.id === dragRef.current!.id ? { ...l, x: x - dragRef.current!.ox, y: y - dragRef.current!.oy } : l
      );
      textLinesRef.current = next;
      redrawContent(imagesRef.current, next);
    } else {
      const next = imagesRef.current.map((img) =>
        img.id === dragRef.current!.id ? { ...img, x: x - dragRef.current!.ox, y: y - dragRef.current!.oy } : img
      );
      imagesRef.current = next;
      redrawContent(next, textLinesRef.current);
    }
  }

  function endDrag() {
    if (!dragRef.current) return;
    if (dragRef.current.type === "text") setTextLines([...textLinesRef.current]);
    else setImages([...imagesRef.current]);
    dragRef.current = null;
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
            <div className="preview-stack">
              <canvas
                ref={contentCanvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="preview-content"
                onMouseDown={(e) => beginDrag(e.clientX, e.clientY)}
                onMouseMove={(e) => e.buttons === 1 && moveDrag(e.clientX, e.clientY)}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
              />
              <canvas ref={borderCanvasRef} width={CANVAS_W} height={CANVAS_H} className="preview-border" aria-hidden="true" />
            </div>
          </div>
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
