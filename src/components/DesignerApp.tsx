"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";
import { fitCoverInFrame, fitWidthInFrame } from "@/lib/design";
import AiImageSlot, { type AiSlotResult } from "@/components/AiImageSlot";
import { AI_SLOT_CONFIG } from "@/lib/ai-providers";
import KeyTagMockupPreview from "@/components/KeyTagMockupPreview";
import KeyTagPlaceholder from "@/components/KeyTagPlaceholder";
import {
  drawBorderLayer,
  drawContentLayer,
  mergedPreviewDataUrl,
  payloadForSubmit,
  preloadImage,
} from "@/lib/canvas-render";
import { scaleImageUniform } from "@/lib/canvas-gestures";
import { useCanvasGestures } from "@/hooks/useCanvasGestures";
import { CANVAS_H, CANVAS_W } from "@/lib/keytag-shape";

const FONTS = ["Arial", "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald"];
const AI_SLOT_COUNT = 3;

type AiSlot = AiSlotResult;

/** Tiny gap before slot 3 so two server requests do not collide. */
const AI_STAGGER_MS = 0;
const AI_SLOT3_DELAY_MS = 2500;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function DesignerApp() {
  const contentCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewStackRef = useRef<HTMLDivElement>(null);
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
  const [mockupRevision, setMockupRevision] = useState(0);
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
    setMockupRevision((r) => r + 1);
  }, [tagColor, images, textLines, redrawContent]);

  useCanvasGestures({
    canvasRef: contentCanvasRef,
    touchTargetRef: previewStackRef,
    enabled: canvasReady,
    imagesRef,
    textLinesRef,
    selectedBgIdRef,
    tagColorRef,
    redrawContent,
    onImagesChange: setImages,
    onTextLinesChange: setTextLines,
    onSelectText: setSelectedTextId,
  });

  function scaleActiveImage(factor: number) {
    const id = selectedBgId || images[0]?.id;
    if (!id) return;
    setImages((prev) => prev.map((img) => (img.id === id ? scaleImageUniform(img, factor) : img)));
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function addUploadedImage(dataUrl: string, naturalW: number, naturalH: number) {
    const placement = fitCoverInFrame(naturalW, naturalH);
    const img: DesignImage = {
      id: uid(),
      url: dataUrl,
      originalUrl: dataUrl,
      ...placement,
      rotation: 0,
    };
    setImages((prev) => [...prev, img]);
    setSelectedBgId(img.id);
  }

  async function addAiImage(url: string) {
    const image = await preloadImage(url, imageCache.current);
    const placement = fitWidthInFrame(image.naturalWidth, image.naturalHeight);
    const img: DesignImage = { id: uid(), url, ...placement, rotation: 0 };
    setImages((prev) => [...prev, img]);
    setSelectedBgId(img.id);
  }

  async function onUpload(file: File) {
    const dataUrl = await fileToDataUrl(file);
    const image = await preloadImage(dataUrl, imageCache.current);
    await addUploadedImage(dataUrl, image.naturalWidth, image.naturalHeight);
    setFitMode("auto");
  }

  useEffect(() => {
    if (!aiLoading || aiResults.length < AI_SLOT_COUNT) return;
    const ok = aiResults.filter((s) => s.status === "ok").length;
    if (ok === AI_SLOT_COUNT) {
      setAiLoading(false);
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
    await addAiImage(url);
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
    if (images.length === 0) {
      setMessage("Please add an image before submitting.");
      return;
    }

    setMessage("Submitting…");
    try {
      const previewDataUrl = mergedPreviewDataUrl(canvas, border, "image/jpeg");
      const raw: DesignPayload = { tagColor, images, textLines, backgroundImageId: selectedBgId, fitMode };
      const payload = await payloadForSubmit(raw, imageCache.current);

      const res = await fetch("/api/designs/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagColor, designJson: payload, previewDataUrl }),
      });
      const data = await res.json();
      setMessage(data.success ? "Submitted!" : data.error || "Submit failed");
    } catch {
      setMessage("Submit failed — try a smaller photo or use Wi‑Fi.");
    }
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
          <div className="preview-stack" ref={previewStackRef}>
            {!canvasReady && <KeyTagPlaceholder />}
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
        <div className="preview-hints">
          <p>Upload or create your own image with AI</p>
          <p>The black space is where the image will appear</p>
          <p>The red frame and all outside of that is not where the image would appear</p>
          {images.length > 0 && (
            <p>Drag to move · Pinch with two fingers to resize (or use − + below)</p>
          )}
        </div>
        {images.length > 0 && (
          <div className="image-scale-bar">
            <button type="button" className="btn secondary compact" onClick={() => scaleActiveImage(0.9)} aria-label="Smaller">−</button>
            <span className="muted">Image size</span>
            <button type="button" className="btn secondary compact" onClick={() => scaleActiveImage(1.1)} aria-label="Larger">+</button>
          </div>
        )}
        <KeyTagMockupPreview
          contentCanvasRef={contentCanvasRef}
          active={images.length > 0}
          revision={mockupRevision}
        />
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
          <button className="btn secondary compact" onClick={() => setAiOpen(true)}>Generate image with AI</button>
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
                All 3 start generating right away — they may finish at different times.
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
                {aiSeeds.map((seed, i) => {
                  const cfg = AI_SLOT_CONFIG[i];
                  return (
                  <AiImageSlot
                    key={`${aiRunId}-${i}`}
                    id={aiResults[i]?.id ?? `ai-${aiRunId}-${i}`}
                    slotNumber={i + 1}
                    provider={cfg.provider}
                    model={cfg.model}
                    prompt={aiPrompt}
                    seed={seed}
                    waitBeforeStart={i === 2 ? AI_SLOT3_DELAY_MS : i * AI_STAGGER_MS}
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
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
