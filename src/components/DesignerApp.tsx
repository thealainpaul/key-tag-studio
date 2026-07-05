"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";
import { coverFitInCanvas } from "@/lib/design";
import { CANVAS_H, CANVAS_W, drawKeyTagBorder, drawKeyTagFill, getTagMetrics } from "@/lib/keytag-shape";

const FONTS = ["Arial", "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald"];
const AI_SLOT_COUNT = 3;

type AiSlot = { id: string; url: string | null; error?: string; status: "loading" | "ok" | "error" };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function preloadImage(url: string, cache: Map<string, HTMLImageElement>) {
  const existing = cache.get(url);
  if (existing?.complete) return Promise.resolve(existing);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      cache.set(url, image);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}

function drawContentLayer(
  canvas: HTMLCanvasElement,
  tagColor: string,
  images: DesignImage[],
  textLines: TextLine[],
  cache: Map<string, HTMLImageElement>
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const metrics = drawKeyTagFill(ctx, CANVAS_W, CANVAS_H, tagColor);

  for (const item of images) {
    const image = cache.get(item.url);
    if (!image?.complete) continue;

    ctx.save();
    metrics.drawGeometry(ctx, 0);
    ctx.clip();

    const centerX = item.x + item.width / 2;
    const centerY = item.y + item.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.drawImage(image, -item.width / 2, -item.height / 2, item.width, item.height);
    ctx.restore();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  textLines.forEach((line) => {
    if (!line.text.trim()) return;
    ctx.font = `${line.fontSize}px "${line.fontFamily}"`;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, line.x, line.y);
  });
}

function drawBorderLayer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  drawKeyTagBorder(ctx, getTagMetrics(CANVAS_W, CANVAS_H));
}

export default function DesignerApp() {
  const contentCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const imagesRef = useRef<DesignImage[]>([]);
  const textLinesRef = useRef<TextLine[]>([]);
  const selectedBgIdRef = useRef<string | null>(null);

  const [tagColor, setTagColor] = useState("#1f1f1f");
  const [images, setImages] = useState<DesignImage[]>([]);
  const [textLines, setTextLines] = useState<TextLine[]>([]);
  const [selectedBgId, setSelectedBgId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResults, setAiResults] = useState<AiSlot[]>([]);
  const [message, setMessage] = useState("");
  const dragRef = useRef<{ type: "text" | "image"; id: string; ox: number; oy: number } | null>(null);
  const tagColorRef = useRef(tagColor);

  imagesRef.current = images;
  textLinesRef.current = textLines;
  selectedBgIdRef.current = selectedBgId;
  tagColorRef.current = tagColor;

  const redrawContent = useCallback(
    (nextImages = imagesRef.current, nextTextLines = textLinesRef.current, nextTagColor = tagColor) => {
      const canvas = contentCanvasRef.current;
      if (!canvas) return;
      drawContentLayer(canvas, nextTagColor, nextImages, nextTextLines, imageCache.current);
    },
    [tagColor]
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      const canvas = borderCanvasRef.current;
      if (canvas) drawBorderLayer(canvas);
    });
  }, []);

  useEffect(() => {
    redrawContent();
  }, [tagColor, images, textLines, redrawContent]);

  function canvasPoint(clientX: number, clientY: number) {
    const canvas = contentCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }

  function hitText(ctx: CanvasRenderingContext2D, line: TextLine, x: number, y: number) {
    ctx.font = `${line.fontSize}px "${line.fontFamily}"`;
    const w = ctx.measureText(line.text).width;
    const h = line.fontSize * 1.3;
    return x >= line.x - w / 2 - 16 && x <= line.x + w / 2 + 16 && y >= line.y - h / 2 - 16 && y <= line.y + h / 2 + 16;
  }

  function beginDrag(clientX: number, clientY: number) {
    const canvas = contentCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const bgImage = imagesRef.current.find((i) => i.id === selectedBgIdRef.current) || imagesRef.current[0];
    const { x, y } = canvasPoint(clientX, clientY);
    const hit = [...textLinesRef.current].reverse().find((line) => line.text.trim() && hitText(ctx, line, x, y));

    if (hit) {
      setSelectedTextId(hit.id);
      dragRef.current = { type: "text", id: hit.id, ox: x - hit.x, oy: y - hit.y };
      return;
    }
    if (bgImage) {
      setSelectedTextId(null);
      dragRef.current = { type: "image", id: bgImage.id, ox: x - bgImage.x, oy: y - bgImage.y };
    }
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragRef.current) return;
    const { x, y } = canvasPoint(clientX, clientY);

    if (dragRef.current.type === "text") {
      const next = textLinesRef.current.map((line) =>
        line.id === dragRef.current!.id ? { ...line, x: x - dragRef.current!.ox, y: y - dragRef.current!.oy } : line
      );
      textLinesRef.current = next;
      redrawContent(imagesRef.current, next, tagColorRef.current);
    } else {
      const next = imagesRef.current.map((img) =>
        img.id === dragRef.current!.id ? { ...img, x: x - dragRef.current!.ox, y: y - dragRef.current!.oy } : img
      );
      imagesRef.current = next;
      redrawContent(next, textLinesRef.current, tagColorRef.current);
    }
  }

  function endDrag() {
    if (!dragRef.current) return;
    if (dragRef.current.type === "text") setTextLines([...textLinesRef.current]);
    else setImages([...imagesRef.current]);
    dragRef.current = null;
  }

  useEffect(() => {
    const canvas = contentCanvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      beginDrag(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => endDrag();

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [redrawContent]);

  async function addFittedImage(url: string) {
    const image = await preloadImage(url, imageCache.current);
    const fit = coverFitInCanvas(image.naturalWidth, image.naturalHeight);
    const img: DesignImage = { id: uid(), url, ...fit, rotation: 0 };
    setImages((prev) => [...prev, img]);
    setSelectedBgId(img.id);
  }

  async function onUpload(file: File) {
    const url = URL.createObjectURL(file);
    await addFittedImage(url);
  }

  async function generateAi() {
    setAiLoading(true);
    setAiError("");
    setAiResults(
      Array.from({ length: AI_SLOT_COUNT }, (_, i) => ({
        id: `loading-${i}`,
        url: null,
        status: "loading" as const,
      }))
    );
    try {
      const res = await fetch("/api/designer/generate-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const data = await res.json();
      const slots: AiSlot[] = (data.images ?? []).map(
        (img: { id: string; url: string | null; error?: string }) => ({
          id: img.id,
          url: img.url,
          error: img.error,
          status: img.url ? ("ok" as const) : ("error" as const),
        })
      );
      while (slots.length < AI_SLOT_COUNT) {
        slots.push({ id: `empty-${slots.length}`, url: null, status: "error", error: "Missing result" });
      }
      setAiResults(slots.slice(0, AI_SLOT_COUNT));
      if (!data.success) throw new Error(data.error || "Failed to generate images");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to generate images");
      setAiResults((prev) =>
        prev.map((slot) =>
          slot.status === "loading" ? { ...slot, status: "error" as const, error: "Failed" } : slot
        )
      );
    } finally {
      setAiLoading(false);
    }
  }

  async function pickAiImage(url: string) {
    await addFittedImage(url);
    setAiOpen(false);
    setAiResults([]);
  }

  function addTextLine() {
    setShowText(true);
    setTextLines((lines) => [
      ...lines,
      {
        id: uid(),
        text: "",
        fontFamily: "Arial",
        fontSize: 32,
        color: "#ffffff",
        x: CANVAS_W * 0.5,
        y: CANVAS_H * 0.5,
        linkedImageId: null,
      },
    ]);
  }

  async function submitDesign() {
    const canvas = contentCanvasRef.current;
    const border = borderCanvasRef.current;
    let previewDataUrl = canvas?.toDataURL("image/png");

    if (canvas && border) {
      const merged = document.createElement("canvas");
      merged.width = CANVAS_W;
      merged.height = CANVAS_H;
      const ctx = merged.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas, 0, 0);
        ctx.drawImage(border, 0, 0);
        previewDataUrl = merged.toDataURL("image/png");
      }
    }

    const payload: DesignPayload = { tagColor, images, textLines, backgroundImageId: selectedBgId };
    const res = await fetch("/api/designs/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagColor, designJson: payload, previewDataUrl }),
    });
    const data = await res.json();
    setMessage(data.success ? "Submitted!" : data.error || "Submit failed");
  }

  function updateLine(id: string, patch: Partial<TextLine>) {
    setTextLines((lines) => lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  return (
    <div className="designer-page">
      <div className="designer-nav">
        <Link href="/"><strong>Key Tag Studio</strong></Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Link href="/admin/login" className="muted" style={{ fontSize: "0.8rem" }}>Admin</Link>
          <button className="btn compact" onClick={submitDesign}>Submit</button>
        </div>
      </div>

      <div className="preview-panel">
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
        <div className="instructions">
          <p>Upload or create your own image with AI.</p>
          <p>The black space is where the image will appear.</p>
          <p>The red frame and all outside of that is not where the image would appear.</p>
        </div>
      </div>

      <div className="controls">
        <div className="toolbar">
          <input
            type="color"
            className="color-input"
            value={tagColor}
            onChange={(e) => setTagColor(e.target.value)}
            aria-label="Tag color"
          />
          <label className="btn secondary compact" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            Upload (we fit it for you)
            <input hidden type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
          <button className="btn secondary compact" onClick={() => setAiOpen(true)}>AI</button>
          <button className="btn secondary compact" onClick={addTextLine}>+ Text</button>
        </div>

        {showText && textLines.map((line) => (
          <div key={line.id} className={`text-block${selectedTextId === line.id ? " selected" : ""}`}>
            <div className="field">
              <input
                value={line.text}
                placeholder="Your text"
                onChange={(e) => updateLine(line.id, { text: e.target.value })}
                onFocus={() => setSelectedTextId(line.id)}
              />
            </div>
            <div className="text-row">
              <div className="field">
                <select value={line.fontFamily} onChange={(e) => updateLine(line.id, { fontFamily: e.target.value })}>
                  {FONTS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="field">
                <input type="number" value={line.fontSize} onChange={(e) => updateLine(line.id, { fontSize: Number(e.target.value) })} aria-label="Font size" />
              </div>
              <div className="field">
                <input type="color" value={line.color} onChange={(e) => updateLine(line.id, { color: e.target.value })} aria-label="Text color" />
              </div>
              <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
                <button className="btn danger compact" style={{ width: "100%" }} onClick={() => setTextLines((lines) => lines.filter((l) => l.id !== line.id))}>Remove</button>
              </div>
            </div>
          </div>
        ))}

        {message && <p className="message">{message}</p>}
      </div>

      {aiOpen && (
        <div className="modal-backdrop" onClick={() => setAiOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="field">
              <textarea rows={2} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Describe your image…" />
            </div>
            {aiError && <p style={{ color: "var(--danger)" }}>{aiError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn" onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}>
                {aiLoading ? "Generating…" : "Generate 3"}
              </button>
              <button className="btn secondary" onClick={() => setAiOpen(false)}>Close</button>
            </div>
            {(aiLoading || aiResults.length > 0) && (
              <div className="ai-grid">
                {(aiResults.length > 0
                  ? aiResults
                  : Array.from({ length: AI_SLOT_COUNT }, (_, i) => ({
                      id: `placeholder-${i}`,
                      url: null,
                      status: "loading" as const,
                    }))
                ).map((slot) => (
                  <div key={slot.id} className={`ai-slot ai-slot-${slot.status}`}>
                    {slot.status === "ok" && slot.url ? (
                      <img src={slot.url} alt="" onClick={() => pickAiImage(slot.url!)} />
                    ) : slot.status === "error" ? (
                      <span className="ai-slot-msg">{slot.error || "Failed"}</span>
                    ) : (
                      <span className="ai-slot-msg">Generating…</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
