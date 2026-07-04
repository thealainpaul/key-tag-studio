"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";

const FONTS = ["Arial", "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald"];
const CANVAS_W = 1086;
const CANVAS_H = 845;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultLines(): TextLine[] {
  return [
    { id: uid(), text: "RETURN TO POSTBOX", fontFamily: "Arial", fontSize: 32, color: "#ffffff", x: 200, y: 200, linkedImageId: null },
    { id: uid(), text: "DROP IN MAILBOX", fontFamily: "Arial", fontSize: 32, color: "#ffffff", x: 200, y: 500, linkedImageId: null },
  ];
}

export default function DesignerApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tagColor, setTagColor] = useState("#1f1f1f");
  const [images, setImages] = useState<DesignImage[]>([]);
  const [textLines, setTextLines] = useState<TextLine[]>(defaultLines);
  const [selectedBgId, setSelectedBgId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResults, setAiResults] = useState<{ url: string; id: string }[]>([]);
  const [message, setMessage] = useState("");
  const dragRef = useRef<{ type: "text" | "image"; id: string; ox: number; oy: number } | null>(null);

  const bgImage = images.find((i) => i.id === selectedBgId) || images[0];

  useEffect(() => {
    draw();
  }, [tagColor, images, textLines, bgImage]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = tagColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const drawImg = (img: DesignImage) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = img.url;
      image.onload = () => {
        ctx.save();
        ctx.translate(img.x + img.width / 2, img.y + img.height / 2);
        ctx.rotate((img.rotation * Math.PI) / 180);
        ctx.drawImage(image, -img.width / 2, -img.height / 2, img.width, img.height);
        ctx.restore();
      };
    };

    images.forEach(drawImg);

    textLines.forEach((line) => {
      ctx.fillStyle = line.color;
      ctx.font = `${line.fontSize}px ${line.fontFamily}`;
      ctx.fillText(line.text, line.x, line.y);
    });

    // engraving safe area guide
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, CANVAS_W - 120, CANVAS_H - 120);
  }

  function onCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const hitText = [...textLines].reverse().find((t) => x >= t.x - 10 && x <= t.x + 400 && y >= t.y - t.fontSize && y <= t.y + 10);
    if (hitText) {
      setSelectedTextId(hitText.id);
      dragRef.current = { type: "text", id: hitText.id, ox: x - hitText.x, oy: y - hitText.y };
      return;
    }
    if (bgImage) {
      setSelectedTextId(null);
      dragRef.current = { type: "image", id: bgImage.id, ox: x - bgImage.x, oy: y - bgImage.y };
    }
  }

  function onCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (dragRef.current.type === "text") {
      setTextLines((lines) =>
        lines.map((l) => (l.id === dragRef.current!.id ? { ...l, x: x - dragRef.current!.ox, y: y - dragRef.current!.oy } : l))
      );
    } else {
      setImages((imgs) =>
        imgs.map((img) => (img.id === dragRef.current!.id ? { ...img, x: x - dragRef.current!.ox, y: y - dragRef.current!.oy } : img))
      );
    }
  }

  function onCanvasMouseUp() {
    dragRef.current = null;
  }

  async function onUpload(file: File) {
    const url = URL.createObjectURL(file);
    const img: DesignImage = { id: uid(), url, x: 100, y: 100, width: 500, height: 400, rotation: 0 };
    setImages((prev) => [...prev, img]);
    setSelectedBgId(img.id);
  }

  async function generateAi() {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/designer/generate-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to generate images");
      setAiResults(data.images);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to generate images");
    } finally {
      setAiLoading(false);
    }
  }

  function pickAiImage(url: string) {
    const img: DesignImage = { id: uid(), url, x: 80, y: 80, width: 900, height: 680, rotation: 0 };
    setImages((prev) => [...prev, img]);
    setSelectedBgId(img.id);
    setAiOpen(false);
    setAiResults([]);
  }

  async function suggestLayout() {
    const res = await fetch("/api/designer/ai-suggestions", { method: "POST" });
    const data = await res.json();
    if (!data.success || !data.suggestions?.[0]) return;
    const s = data.suggestions[0];
    setTextLines((lines) =>
      lines.map((line, i) => {
        const pos = s.textLines[i];
        if (!pos) return line;
        return { ...line, text: pos.text, y: pos.y * CANVAS_H };
      })
    );
  }

  async function submitDesign() {
    const canvas = canvasRef.current;
    const previewDataUrl = canvas?.toDataURL("image/png");
    const payload: DesignPayload = { tagColor, images, textLines, backgroundImageId: selectedBgId };
    const res = await fetch("/api/designs/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagColor, designJson: payload, previewDataUrl }),
    });
    const data = await res.json();
    setMessage(data.success ? "Submitted for review!" : data.error || "Submit failed");
  }

  function updateLine(id: string, patch: Partial<TextLine>) {
    setTextLines((lines) => lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  return (
    <div className="container">
      <div className="nav">
        <Link href="/"><strong>Key Tag Studio</strong></Link>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href="/admin/login" className="btn secondary">Admin</Link>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Layout setup</h3>
          <p className="muted">Upload art, add text and choose a layout.</p>

          <div className="field">
            <label>Tag Color</label>
            <input type="color" value={tagColor} onChange={(e) => setTagColor(e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <label className="btn secondary" style={{ cursor: "pointer" }}>
              📁 Upload
              <input hidden type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
            </label>
            <button className="btn secondary" onClick={() => setAiOpen(true)}>🎨 AI</button>
            <button className="btn secondary" onClick={suggestLayout}>⚡ Suggest</button>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <button className="btn secondary" onClick={() => setTextLines((l) => [...l, { id: uid(), text: "NEW LINE", fontFamily: "Arial", fontSize: 28, color: "#ffffff", x: 150, y: 300, linkedImageId: null }])}>+ Add line</button>
          </div>

          {textLines.map((line) => (
            <div key={line.id} className="card" style={{ marginBottom: "0.75rem", borderColor: selectedTextId === line.id ? "var(--primary)" : undefined }}>
              <div className="field"><label>Text</label><input value={line.text} onChange={(e) => updateLine(line.id, { text: e.target.value })} /></div>
              <div className="field"><label>Font</label>
                <select value={line.fontFamily} onChange={(e) => updateLine(line.id, { fontFamily: e.target.value })}>
                  {FONTS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="field"><label>Size</label><input type="number" value={line.fontSize} onChange={(e) => updateLine(line.id, { fontSize: Number(e.target.value) })} /></div>
              <div className="field"><label>Color</label><input type="color" value={line.color} onChange={(e) => updateLine(line.id, { color: e.target.value })} /></div>
              <button className="btn danger" onClick={() => setTextLines((lines) => lines.filter((l) => l.id !== line.id))}>Remove</button>
            </div>
          ))}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button className="btn secondary" onClick={() => { setTextLines(defaultLines()); setImages([]); setTagColor("#1f1f1f"); }}>Reset</button>
            <button className="btn" onClick={submitDesign}>Submit for review</button>
          </div>
          {message && <p className="muted" style={{ marginTop: "0.75rem" }}>{message}</p>}
        </div>

        <div className="card">
          <h3>Live preview</h3>
          <p className="muted">Anything inside the red shape will be engraved on the key tag.</p>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ width: "100%", height: "auto", borderRadius: 8, border: "1px solid var(--border)", cursor: "grab" }}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
          />
          <p className="muted">1086 × 845 px — Saved as JSON + image</p>
        </div>
      </div>

      {aiOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 50 }} onClick={() => setAiOpen(false)}>
          <div className="card" style={{ width: "min(640px, 92vw)" }} onClick={(e) => e.stopPropagation()}>
            <h3>🎨 Generate Background with AI</h3>
            <div className="field">
              <label>Describe your background</label>
              <textarea rows={3} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g. vibrant sunset over mountains" />
            </div>
            {aiError && <p style={{ color: "var(--danger)" }}>Error: {aiError}</p>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn" onClick={generateAi} disabled={aiLoading}>{aiLoading ? "Generating..." : "✨ Generate 3 Images"}</button>
              <button className="btn secondary" onClick={() => setAiOpen(false)}>Cancel</button>
            </div>
            {aiResults.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginTop: "1rem" }}>
                {aiResults.map((img) => (
                  <img key={img.id} src={img.url} alt="AI option" style={{ width: "100%", borderRadius: 8, cursor: "pointer", border: "2px solid var(--border)" }} onClick={() => pickAiImage(img.url)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
