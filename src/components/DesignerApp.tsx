"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";
import { fitCoverInFrame } from "@/lib/design";
import AiImageSlot, { type AiSlotResult } from "@/components/AiImageSlot";
import KeyTagMockupPreview from "@/components/KeyTagMockupPreview";
import KeyTagPlaceholder from "@/components/KeyTagPlaceholder";
import {
  drawBorderLayer,
  drawContentLayer,
  fullSourceDataUrl,
  payloadForSubmit,
  preloadAllImages,
  preloadImage,
  printFileDataUrl,
} from "@/lib/canvas-render";
import { scaleImageUniform } from "@/lib/canvas-gestures";
import { useCanvasGestures } from "@/hooks/useCanvasGestures";
import { CANVAS_H, CANVAS_W, mmToPx } from "@/lib/keytag-shape";
import { parseLocale, t } from "@/lib/i18n";
import {
  clampQrSize,
  QR_DEFAULT_PX,
  QR_MAX_PX,
  QR_MIN_PX,
  qrDefaultCenter,
  qrModuleSizeMm,
} from "@/lib/qrcode-render";

const FONTS = ["Arial", "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald"];

/** Canvas pixels per millimetre — used for the QR size readout. */
const mmPx = mmToPx(1);

/**
 * Two strings that were hardcoded in English and so never translated.
 * Kept here rather than in i18n.ts to avoid touching shared files.
 */
const EXTRA_STRINGS: Record<string, { qrHint: string; scaleHint: string; forMeHint: string }> = {
  de: {
    qrHint:
      "Aktivieren Sie dieses Feld, um einen QR-Code hinzuzufügen, und geben Sie anschließend Ihre Website ein — für einen scanbaren QR-Code zu Ihrer Website.",
    scaleHint: "Bild wird eingepasst. Mit + / − können Sie die Größe ändern.",
    forMeHint:
      "Wir gestalten es für Sie — laden Sie Ihr Bild hoch oder erstellen Sie eines mit KI, und wir setzen es für Sie ein.",
  },
  fr: {
    qrHint:
      "Cochez cette case pour ajouter un QR code, puis saisissez votre site web dans le champ qui apparaît, pour un QR code scannable vers votre site.",
    scaleHint: "Image ajustée. Utilisez les boutons + / − pour redimensionner.",
    forMeHint:
      "Nous le concevons pour vous — téléchargez votre image ou créez-en une avec l\u2019IA, et nous la placerons pour vous.",
  },
  it: {
    qrHint:
      "Seleziona questa casella per aggiungere un codice QR, poi inserisci il tuo sito web nel campo che appare, per un codice QR scansionabile.",
    scaleHint: "Immagine adattata. Usa i pulsanti + / − per ridimensionare.",
    forMeHint:
      "Lo progettiamo noi per te — carica la tua immagine o creane una con l\u2019IA e la posizioneremo noi per te.",
  },
  es: {
    qrHint:
      "Marque esta casilla para añadir un código QR y luego escriba su sitio web en el campo que aparece, para un código QR escaneable.",
    scaleHint: "Imagen ajustada. Use los botones + / − para cambiar el tamaño.",
    forMeHint:
      "Lo diseñamos por usted — suba su imagen o cree una con IA y la colocaremos por usted.",
  },
  en: {
    qrHint:
      "Check this box to add a QR code and then add your website to the box that appears, for a scannable QR Code to your website.",
    scaleHint: "Image scaled to fit. Use + / − buttons to resize.",
    forMeHint:
      "Design it for me — upload your image or create one with AI, and we will place it on the tag for you.",
  },
};

function extraStrings(locale: string) {
  return EXTRA_STRINGS[locale] || EXTRA_STRINGS.en;
}
const AI_SLOT_COUNT = 3;

// The WordPress shop. Cart, quantity, pricing and payment all live there.
// This app only produces the design.
const SHOP_ORIGIN = "https://bik-ag.ch";

type AiSlot = AiSlotResult;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function DesignerApp() {
  const searchParams = useSearchParams();
  const locale = useMemo(() => parseLocale(searchParams.get("lang")), [searchParams]);
  const labels = t(locale);
  const extra = useMemo(() => extraStrings(String(locale)), [locale]);
  const embed = searchParams.get("embed") === "1";
  const contentCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewStackRef = useRef<HTMLDivElement>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const imagesRef = useRef<DesignImage[]>([]);
  const textLinesRef = useRef<TextLine[]>([]);
  const selectedBgIdRef = useRef<string | null>(null);
  const mockupCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /**
   * The customer's source image exactly as it arrived — before fitCoverInFrame
   * cropped it to the tag. Only submitted when "design it for me" is ticked.
   */
  const fullSourceRef = useRef<string | null>(null);
  const designForMeRef = useRef(false);

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
  const [designForMe, setDesignForMe] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [mockupRevision, setMockupRevision] = useState(0);
  const [qrEnabled, setQrEnabled] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [qrSize, setQrSize] = useState(QR_DEFAULT_PX);
  const [qrX, setQrX] = useState(() => qrDefaultCenter(QR_DEFAULT_PX).x);
  const [qrY, setQrY] = useState(() => qrDefaultCenter(QR_DEFAULT_PX).y);
  const [qrColor, setQrColor] = useState("#000000");
  const [qrHalo, setQrHalo] = useState(true);
  const tagColorRef = useRef(tagColor);

  imagesRef.current = images;
  textLinesRef.current = textLines;
  selectedBgIdRef.current = selectedBgId;
  tagColorRef.current = tagColor;
  designForMeRef.current = designForMe;

  const qrCodeState = useMemo(
    () => ({
      enabled: qrEnabled,
      url: qrUrl.startsWith("http") ? qrUrl : qrUrl ? `https://${qrUrl}` : "",
      x: qrX,
      y: qrY,
      size: qrSize,
      color: qrColor,
      halo: qrHalo,
    }),
    [qrEnabled, qrUrl, qrX, qrY, qrSize, qrColor, qrHalo]
  );

  const qrCodeStateRef = useRef(qrCodeState);
  qrCodeStateRef.current = qrCodeState;

  const qrModuleMm = useMemo(
    () => (qrEnabled && qrUrl.trim() ? qrModuleSizeMm(qrCodeState.url, qrSize) : 0),
    [qrEnabled, qrUrl, qrCodeState.url, qrSize]
  );

  const redrawContent = useCallback(
    (nextImages = imagesRef.current, nextTextLines = textLinesRef.current, nextTagColor = tagColor) => {
      const canvas = contentCanvasRef.current;
      if (!canvas) return;
      drawContentLayer(canvas, nextTagColor, nextImages, nextTextLines, imageCache.current, qrCodeStateRef.current);
    },
    [tagColor]
  );

  useLayoutEffect(() => {
    const content = contentCanvasRef.current;
    const border = borderCanvasRef.current;
    if (content) drawContentLayer(content, tagColor, [], [], imageCache.current, { enabled: false, url: "" });
    if (border) drawBorderLayer(border);
    setCanvasReady(true);
  }, []);

  useEffect(() => {
    redrawContent();
    setMockupRevision((r) => r + 1);
  }, [tagColor, images, textLines, qrCodeState, redrawContent]);

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

  /**
   * Save the current design to WordPress and return its id.
   * Called by the WordPress page, not by any button in here.
   */
  const saveDesign = useCallback(async (): Promise<{ ok: boolean; designId?: string; error?: string }> => {
    const canvas = contentCanvasRef.current;
    const border = borderCanvasRef.current;

    if (!canvas || !border) {
      return { ok: false, error: "canvas_not_ready" };
    }
    if (imagesRef.current.length === 0) {
      return { ok: false, error: "no_image" };
    }

    const finalQrUrl = qrEnabled && qrUrl.trim() && !qrUrl.startsWith("http") ? `https://${qrUrl}` : qrUrl;

    const raw: DesignPayload = {
      tagColor: tagColorRef.current,
      images: imagesRef.current,
      textLines: textLinesRef.current,
      backgroundImageId: selectedBgIdRef.current,
      fitMode,
      designForMe: designForMeRef.current,
      qrCode: { enabled: qrEnabled, url: finalQrUrl, x: qrX, y: qrY, size: qrSize, color: qrColor, halo: qrHalo },
    };

    const payload = await payloadForSubmit(raw, imageCache.current);

    // payloadForSubmit rewrites image URLs, so they must be re-cached before
    // the print file is drawn — otherwise the artwork renders blank.
    await preloadAllImages(payload.images, imageCache.current);

    // Production artwork: the real tag, no red guide border, 1200 DPI.
    const printDataUrl = await printFileDataUrl(payload, imageCache.current);

    // Reference mockup: how the tag will look in the customer's hand.
    let mockupDataUrl = "";
    try {
      if (mockupCanvasRef.current) {
        mockupDataUrl = mockupCanvasRef.current.toDataURL("image/jpeg", 0.9);
      }
    } catch {
      /* mockup is optional */
    }

    // Third file, only when the customer asked BIK to do the design: the whole
    // source picture, uncropped, so it can be placed in the editor by hand.
    let fullSource = "";
    if (designForMeRef.current && fullSourceRef.current) {
      try {
        fullSource = await fullSourceDataUrl(fullSourceRef.current);
      } catch {
        /* the order must still go through without it */
      }
    }

    const res = await fetch(`${SHOP_ORIGIN}/wp-json/bik/v1/save-design`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: printDataUrl,
        mockup: mockupDataUrl,
        fullSource,
        designForMe: designForMeRef.current,
        designJson: payload,
        tagColor: tagColorRef.current,
        locale,
      }),
    });

    const data = await res.json();

    if (!data.success || !data.design_id) {
      return { ok: false, error: data.error || "save_failed" };
    }

    return { ok: true, designId: data.design_id };
  }, [fitMode, qrEnabled, qrUrl, qrX, qrY, qrSize, qrColor, qrHalo, locale]);

  /**
   * Listen for instructions from the WordPress page.
   *
   * bik_request_design  → save the design, reply with bik_design_ready
   * bik_ping            → reply with bik_pong so the page knows we are loaded
   *
   * Replies also report whether a design exists yet, so the page can keep
   * its checkout button disabled until the customer has added something.
   */
  useEffect(() => {
    function reply(payload: Record<string, unknown>) {
      try {
        window.parent.postMessage(payload, "*");
      } catch {
        /* ignore */
      }
    }

    async function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "bik_ping") {
        reply({ type: "bik_pong", hasDesign: imagesRef.current.length > 0 });
        return;
      }

      if (data.type === "bik_request_design") {
        if (imagesRef.current.length === 0) {
          reply({ type: "bik_design_failed", error: "no_image" });
          setMessage(labels.needImage);
          return;
        }

        setMessage(labels.checkingOut);

        try {
          const result = await saveDesign();
          if (result.ok && result.designId) {
            reply({ type: "bik_design_ready", design_id: result.designId });
          } else {
            reply({ type: "bik_design_failed", error: result.error });
            setMessage(labels.checkoutFailed);
          }
        } catch (e) {
          console.error("Design save failed:", e);
          reply({ type: "bik_design_failed", error: "exception" });
          setMessage(labels.checkoutFailed);
        }
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [saveDesign, labels]);

  /**
   * Tell the page whenever the design becomes non-empty or empty again,
   * so its checkout button can enable and disable itself.
   */
  useEffect(() => {
    try {
      window.parent.postMessage(
        { type: "bik_design_state", hasDesign: images.length > 0 },
        "*"
      );
    } catch {
      /* ignore */
    }
  }, [images.length]);

  /** Announce readiness once on load. */
  useEffect(() => {
    try {
      window.parent.postMessage({ type: "bik_studio_ready" }, "*");
    } catch {
      /* ignore */
    }
  }, []);

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
    const placement = fitCoverInFrame(image.naturalWidth, image.naturalHeight);
    const img: DesignImage = { id: uid(), url, ...placement, rotation: 0 };
    setImages((prev) => [...prev, img]);
    setSelectedBgId(img.id);
  }

  async function onUpload(file: File) {
    const dataUrl = await fileToDataUrl(file);
    const image = await preloadImage(dataUrl, imageCache.current);
    // Kept before any cropping, so "design it for me" submits the whole picture.
    fullSourceRef.current = dataUrl;
    await addUploadedImage(dataUrl, image.naturalWidth, image.naturalHeight);
    setFitMode("auto");
  }

  async function generateAi() {
    setAiLoading(true);
    setAiError("");
    const runId = Date.now();
    setAiRunId(runId);

    setAiResults(
      Array.from({ length: AI_SLOT_COUNT }, (_, i) => ({
        id: `ai-${runId}-${i}`,
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

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.success) {
        setAiError(data.error || "Could not generate images");
        setAiResults((prev) => prev.map((s) => ({ ...s, status: "error" as const })));
      } else {
        setAiResults(
          data.images.map((img: { id: string; url: string | null }) => ({
            id: img.id,
            url: img.url,
            status: img.url ? ("ok" as const) : ("error" as const),
          }))
        );
      }
    } catch (e) {
      console.error("AI generation failed:", e);
      setAiError("Could not generate images");
      setAiResults((prev) => prev.map((s) => ({ ...s, status: "error" as const })));
    }

    setAiLoading(false);
  }

  async function pickAiImage(url: string) {
    // The generated image at its full dimensions, before it is fitted to the tag.
    fullSourceRef.current = url;
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

  function updateLine(id: string, patch: Partial<TextLine>) {
    setTextLines((lines) => lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  return (
    <div className={`designer-page${embed ? " embed" : ""}`}>
      <div className="designer-nav">
        {!embed && (
          <Link href="/admin/login" className="muted" style={{ fontSize: "0.8rem" }}>
            {labels.admin}
          </Link>
        )}
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
            <canvas
              ref={borderCanvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="preview-border"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="preview-hints">
          <p>{labels.hintUpload}</p>
          <p>{labels.hintBlack}</p>
          <p>{labels.hintRed}</p>
          {images.length > 0 && <p>{labels.hintGestures}</p>}
        </div>
        {images.length > 0 && (
          <div className="image-scale-bar">
            <button
              type="button"
              className="btn secondary compact"
              onClick={() => scaleActiveImage(0.9)}
              aria-label={labels.smaller}
            >
              −
            </button>
            <span className="muted">{labels.imageSize}</span>
            <button
              type="button"
              className="btn secondary compact"
              onClick={() => scaleActiveImage(1.1)}
              aria-label={labels.larger}
            >
              +
            </button>
          </div>
        )}
        <KeyTagMockupPreview
          outputRef={mockupCanvasRef}
          contentCanvasRef={contentCanvasRef}
          active={true}
          revision={mockupRevision}
          title={labels.mockupTitle}
        />
      </div>

      <div className="controls">
        <div className="toolbar">
          <input
            type="color"
            className="color-input"
            value={tagColor}
            onChange={(e) => setTagColor(e.target.value)}
            aria-label={labels.tagColor}
          />
          <label className="btn secondary compact" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            {labels.upload}
            <input hidden type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
          <button className="btn secondary compact" onClick={() => setAiOpen(true)}>
            {labels.generateAi}
          </button>
          <button className="btn secondary compact" onClick={addTextLine}>
            {labels.addText}
          </button>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", width: "100%", flexWrap: "wrap" }}>
          <input
            type="checkbox"
            checked={designForMe}
            onChange={(e) => setDesignForMe(e.target.checked)}
            style={{ marginTop: "2px", flexShrink: 0 }}
          />
          <span style={{ fontWeight: "bold", fontSize: "14px", flex: 1, minWidth: 0 }}>{extra.forMeHint}</span>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", width: "100%", flexWrap: "wrap" }}>
          <input type="checkbox" checked={qrEnabled} onChange={(e) => setQrEnabled(e.target.checked)} style={{ marginTop: "2px", flexShrink: 0 }} />
          <span style={{ fontWeight: "bold", fontSize: "14px", flex: 1, minWidth: 0 }}>{extra.qrHint}</span>
        </div>

        <div className="field">
          <input
            type="text"
            value={qrUrl}
            placeholder="example.com"
            onChange={(e) => setQrUrl(e.target.value)}
          />
        </div>

        {qrEnabled && qrUrl.trim() && (
          <div className="qr-controls">
            <label className="qr-row">
              <span>Size</span>
              <input
                type="range"
                min={QR_MIN_PX}
                max={QR_MAX_PX}
                step={1}
                value={qrSize}
                onChange={(e) => setQrSize(clampQrSize(Number(e.target.value)))}
              />
              <span className="qr-value">{(qrSize / mmPx).toFixed(1)} mm</span>
            </label>

            <label className="qr-row">
              <span>Left / right</span>
              <input
                type="range"
                min={0}
                max={CANVAS_W}
                step={1}
                value={qrX}
                onChange={(e) => setQrX(Number(e.target.value))}
              />
              <span className="qr-value" />
            </label>

            <label className="qr-row">
              <span>Up / down</span>
              <input
                type="range"
                min={0}
                max={CANVAS_H}
                step={1}
                value={qrY}
                onChange={(e) => setQrY(Number(e.target.value))}
              />
              <span className="qr-value" />
            </label>

            <div className="qr-row">
              <span>Colour</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  className={`btn secondary compact${qrColor === "#000000" ? " selected" : ""}`}
                  onClick={() => setQrColor("#000000")}
                >
                  Black
                </button>
                <button
                  type="button"
                  className={`btn secondary compact${qrColor === "#ffffff" ? " selected" : ""}`}
                  onClick={() => setQrColor("#ffffff")}
                >
                  White
                </button>
                <button
                  type="button"
                  className={`btn secondary compact${!qrHalo ? " selected" : ""}`}
                  onClick={() => setQrHalo((v) => !v)}
                  title="Removes the soft backing behind the code — artwork shows through completely"
                >
                  Transparent
                </button>
              </div>
              <span className="qr-value" />
            </div>

            {qrModuleMm > 0 && qrModuleMm < 0.5 && (
              <p className="qr-warn">
                At this size each QR square is {qrModuleMm.toFixed(2)} mm. Below 0.5 mm the code may not scan
                reliably on a domed tag — make it larger, or use a shorter web address.
              </p>
            )}
          </div>
        )}
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
          {extra.scaleHint}
        </p>

        {showText &&
          textLines.map((line) => (
            <div key={line.id} className={`text-block${selectedTextId === line.id ? " selected" : ""}`}>
              <div className="field">
                <input
                  value={line.text}
                  placeholder={labels.yourText}
                  onChange={(e) => updateLine(line.id, { text: e.target.value })}
                  onFocus={() => setSelectedTextId(line.id)}
                />
              </div>
              <div className="text-row">
                <div className="field">
                  <select value={line.fontFamily} onChange={(e) => updateLine(line.id, { fontFamily: e.target.value })}>
                    {FONTS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <input
                    type="number"
                    value={line.fontSize}
                    onChange={(e) => updateLine(line.id, { fontSize: Number(e.target.value) })}
                    aria-label={labels.fontSize}
                  />
                </div>
                <div className="field">
                  <input
                    type="color"
                    value={line.color}
                    onChange={(e) => updateLine(line.id, { color: e.target.value })}
                    aria-label={labels.textColor}
                  />
                </div>
                <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    className="btn danger compact"
                    style={{ width: "100%" }}
                    onClick={() => setTextLines((lines) => lines.filter((l) => l.id !== line.id))}
                  >
                    {labels.remove}
                  </button>
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
              <textarea
                rows={2}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={labels.aiPlaceholder}
              />
              <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                {labels.aiHint}
              </p>
            </div>
            {aiLoading && (
              <p className="muted" style={{ margin: "0.75rem 0 0", fontSize: "0.9rem" }}>
                {labels.aiProgress}
              </p>
            )}
            {aiError && <p style={{ color: "var(--danger)" }}>{aiError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn" onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}>
                {aiLoading ? labels.generating : labels.generate3}
              </button>
              <button className="btn secondary" onClick={() => setAiOpen(false)}>
                {labels.close}
              </button>
            </div>
            {aiResults.length > 0 && (
              <div className="ai-grid">
                {aiResults.map((result, i) => (
                  <AiImageSlot
                    key={result.id}
                    slotNumber={i + 1}
                    status={result.status}
                    url={result.url}
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