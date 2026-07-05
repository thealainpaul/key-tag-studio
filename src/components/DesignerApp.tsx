"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";
import { naturalCenterPlacement } from "@/lib/design";
import AiImageSlot, { type AiSlotResult } from "@/components/AiImageSlot";
import KeyTagPlaceholder from "@/components/KeyTagPlaceholder";
import {
  drawBorderLayer,
  drawContentLayer,
  mergedPreviewDataUrl,
  payloadForSubmit,
  preloadImage,
} from "@/lib/canvas-render";
import { CANVAS_H, CANVAS_W } from "@/lib/keytag-shape";

const FONTS = ["Arial", "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald"];
const AI_SLOT_COUNT = 3;

type AiSlot = AiSlotResult;

const AI_STAGGER_MS = 15000;

function uid() {
  return Math.random().toString(36).slice(2, 10);
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
  const [aiRunId, setAiRunId] = useState(0);
  const [aiSeeds, setAiSeeds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [fitMode, setFitMode] = useState<"auto" | "manual">("manual");
  const [canvasReady, setCanvasReady] = useState(false);
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

  useLayoutEffect(() => {
    const content = contentCanvasRef.current;
    const border = borderCanvasRef.current;
    if (content) drawContentLayer(content, tagColor, [], [], imageCache.current);
    if (border) drawBorderLayer(border);
    setCanvasReady(true);
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

  async function addImageAtNaturalSize(url: string) {
    const image = await preloadImage(url, imageCache.current);
    const placement = naturalCenterPlacement(image.naturalWidth, image.naturalHeight);
    const img: DesignImage = { id: uid(), url, ...placement, rotation: 0 };
    setImages((prev) => [...prev, img]);
    setSelectedBgId(img.id);
  }

  async function onUpload(file: File) {
    const url = URL.createObjectURL(file);
    await addImageAtNaturalSize(url);
    setFitMode("auto");
  }

  useEffect(() => {
    if (!aiLoading || aiResults.length < AI_SLOT_COUNT) return;
    if (!aiResults.every((s) => s.status !== "loading")) return;
    setAiLoading(false);
    const ok = aiResults.filter((s) => s.status === "ok").length;
    if (ok < AI_SLOT_COUNT) {
      setAiError(`Only ${ok} of 3 images were generated. Please try again.`);
    } else {
      setAiError("");
    }
  }, [aiResults, aiLoading]);

  async function generateAi() {
    setAiLoading(true);
    setAiError("");
    const base = Math.floor(Math.random() * 900_000) + 1000;
    const runId = Date.now();
    setAiRunId(runId);
    setAiSeeds([base, base + 50_000, base + 100_000]);
    setAiResults(
      Array.from({ length: AI_SLOT_COUNT }, (_, i) => ({
        id: `ai-${runId}-${i}`,
        url: null,
        status: "loading" as const,
      }))
    );
  }

  async function pickAiImage(url: string) {
    await addImageAtNaturalSize(url);
    setFitMode("manual");
    setAiOpen(false);
    setAiResults([]);
    setAiSeeds([]);
    setAiLoading(false);
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
    if (!canvas || !border) return;

    const previewDataUrl = mergedPreviewDataUrl(canvas, border);
    const raw: DesignPayload = { tagColor, images, textLines, backgroundImageId: selectedBgId, fitMode };
    const payload = await payloadForSubmit(raw, imageCache.current);

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
        <Link href="/admin/login" className="muted" style={{ fontSize: "0.8rem" }}>Admin</Link>
        <button className="btn compact" onClick={submitDesign}>Submit</button>
      </div>

      <div className="preview-panel">
        <div className="preview-wrap">
          <div className="preview-stack">
            {!canvasReady && <KeyTagPlaceholder />}
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
        <div className="preview-hints">
          <p>Upload or create your own image with AI</p>
          <p>The black space is where the image will appear</p>
          <p>The red frame and all outside of that is not where the image would appear</p>
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
              <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                Images are wide and short to fit the tag. Tall things like guitars are created on their side so the full shape shows.
              </p>
            </div>
            {aiLoading && (
              <p className="muted" style={{ margin: "0.75rem 0 0", fontSize: "0.9rem" }}>
                Your images will appear shortly — please be patient. Each one can take up to a minute to generate.
              </p>
            )}
            {aiError && <p style={{ color: "var(--danger)" }}>{aiError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn" onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}>
                {aiLoading ? "Generating…" : "Generate 3"}
              </button>
              <button className="btn secondary" onClick={() => setAiOpen(false)}>Close</button>
            </div>
            {(aiLoading || aiResults.length > 0) && aiSeeds.length === AI_SLOT_COUNT && (
              <div className="ai-grid">
                {aiSeeds.map((seed, i) => (
                  <AiImageSlot
                    key={`${aiRunId}-${i}`}
                    id={aiResults[i]?.id ?? `ai-${aiRunId}-${i}`}
                    prompt={aiPrompt}
                    seed={seed}
                    waitBeforeStart={i * AI_STAGGER_MS}
                    active={aiLoading}
                    onUpdate={(slot) => {
                      setAiResults((prev) => {
                        const next = [...prev];
                        next[i] = slot;
                        return next;
                      });
                    }}
                    onPick={pickAiImage}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
