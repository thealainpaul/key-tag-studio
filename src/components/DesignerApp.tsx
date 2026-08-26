"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";
import { TEXT_FONTS } from "@/lib/design";
import { fitCoverInFrame, fitCoverInFrameRotated } from "@/lib/design";
import AiImageSlot, { type AiSlotResult } from "@/components/AiImageSlot";
import KeyTagMockupPreview from "@/components/KeyTagMockupPreview";
import KeyTagPlaceholder from "@/components/KeyTagPlaceholder";
import {
  drawBleedLayer,
  drawContentLayer,
  frameColorForImage,
  fullSourceDataUrl,
  payloadForSubmit,
  preloadAllImages,
  preloadImage,
  printFileDataUrl,
  rotatedMockupDataUrl,
} from "@/lib/canvas-render";
import { scaleImageUniform } from "@/lib/canvas-gestures";
import { useCanvasGestures } from "@/hooks/useCanvasGestures";
import { CANVAS_H, CANVAS_W, FRAME_COLOR_DEFAULT, mmToPx } from "@/lib/keytag-shape";
import { parseLocale, t } from "@/lib/i18n";
import {
  clampQrSize,
  QR_DEFAULT_PX,
  QR_MAX_PX,
  QR_MIN_PX,
  qrDefaultCenter,
  qrModuleSizeMm,
} from "@/lib/qrcode-render";


/** Canvas pixels per millimetre — used for the QR size readout. */
const mmPx = mmToPx(1);

/**
 * Two strings that were hardcoded in English and so never translated.
 * Kept here rather than in i18n.ts to avoid touching shared files.
 */
const EXTRA_STRINGS: Record<string, { qrHint: string; scaleHint: string; forMeHint: string; verticalHint: string; shadowHint: string; shadowColor: string; shadowOpacity: string; shadowSize: string; shadowX: string; shadowY: string }> = {
  de: {
    qrHint:
      "Kreuzen Sie dieses Feld an, wenn Sie einen QR-Code möchten, geben Sie dann Ihre URL unten ein und passen Sie Position und Farben mit den Steuerelementen darunter an.",
    scaleHint: "Bild wird eingepasst. Mit + / − können Sie die Größe ändern.",
    forMeHint:
      "Kreuzen Sie dieses Feld an, wenn wir es für Sie machen sollen. (Laden Sie dann einfach ein Bild hoch und senden Sie Ihre Bestellung ab.)",
    verticalHint:
      "Kreuzen Sie dieses Feld an für einen vertikalen Editor und Mockup. (Editor im Hochformat)",
    shadowHint: "Schatten",
    shadowColor: "Schattenfarbe",
    shadowOpacity: "Deckkraft",
    shadowSize: "Grösse",
    shadowX: "Horizontal",
    shadowY: "Vertikal",
  },
  fr: {
    qrHint:
      "Cochez cette case si vous souhaitez un QR code, puis ajoutez votre URL ci-dessous et ajustez la position et les couleurs avec les commandes en dessous.",
    scaleHint: "Image ajustée. Utilisez les boutons + / − pour redimensionner.",
    forMeHint:
      "Cochez cette case si vous souhaitez que nous le fassions pour vous. (Téléchargez simplement une image et envoyez votre commande.)",
    verticalHint:
      "Cochez cette case pour un éditeur et un mockup verticaux. (Éditeur à la verticale)",
    shadowHint: "Ombre",
    shadowColor: "Couleur de l’ombre",
    shadowOpacity: "Opacité",
    shadowSize: "Taille",
    shadowX: "Horizontal",
    shadowY: "Vertical",
  },
  it: {
    qrHint:
      "Seleziona questa casella se desideri un codice QR, poi aggiungi il tuo URL qui sotto e regola posizione e colori con i controlli in basso.",
    scaleHint: "Immagine adattata. Usa i pulsanti + / − per ridimensionare.",
    forMeHint:
      "Seleziona questa casella se vuoi che lo facciamo noi per te. (Carica semplicemente un'immagine e invia il tuo ordine.)",
    verticalHint:
      "Seleziona questa casella per un editor e un mockup verticali. (Editor in verticale)",
    shadowHint: "Ombra",
    shadowColor: "Colore dell’ombra",
    shadowOpacity: "Opacità",
    shadowSize: "Dimensione",
    shadowX: "Orizzontale",
    shadowY: "Verticale",
  },
  es: {
    qrHint:
      "Marque esta casilla si desea un código QR, luego añada su URL abajo y ajuste la posición y los colores con los controles inferiores.",
    scaleHint: "Imagen ajustada. Use los botones + / − para cambiar el tamaño.",
    forMeHint:
      "Marque esta casilla si desea que lo hagamos por usted. (Solo suba una imagen y envíe su pedido.)",
    verticalHint:
      "Marque esta casilla para un editor y un mockup verticales. (Editor en vertical)",
    shadowHint: "Sombra",
    shadowColor: "Color de la sombra",
    shadowOpacity: "Opacidad",
    shadowSize: "Tamaño",
    shadowX: "Horizontal",
    shadowY: "Vertical",
  },
  en: {
    qrHint:
      "Tick this box if you want a QR code, then add your URL below and adjust the position and colors with the controls below.",
    scaleHint: "Image scaled to fit. Use + / − buttons to resize.",
    forMeHint:
      "Tick this box if you want us to do it for you. (Then simply upload an image and send in your order.)",
    verticalHint:
      "Tick this box to get a vertical editor and Mockup. (Editor that is upright)",
    shadowHint: "Shadow",
    shadowColor: "Shadow colour",
    shadowOpacity: "Opacity",
    shadowSize: "Size",
    shadowX: "Horizontal",
    shadowY: "Vertical",
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
  /** Read by the gesture hook, which needs it without re-subscribing. */
  const portraitRef = useRef(false);
  const frameColorRef = useRef(FRAME_COLOR_DEFAULT);

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
  const [portrait, setPortrait] = useState(false);
  const [frameColor, setFrameColor] = useState(FRAME_COLOR_DEFAULT);
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
  portraitRef.current = portrait;
  frameColorRef.current = frameColor;

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
    if (border) drawBleedLayer(border, tagColor, [], imageCache.current);
    setCanvasReady(true);
  }, []);

  // The bleed ring is a separate canvas from the artwork, so it has to be
  // repainted whenever the picture, the tag colour or the overlay changes -
  // the content redraw below does not touch it.
  useEffect(() => {
    const border = borderCanvasRef.current;
    if (border) drawBleedLayer(border, tagColor, images, imageCache.current);
  }, [tagColor, images]);

  useEffect(() => {
    redrawContent();
    setMockupRevision((r) => r + 1);
  }, [tagColor, images, textLines, qrCodeState, redrawContent]);

  useCanvasGestures({
    canvasRef: contentCanvasRef,
    touchTargetRef: previewStackRef,
    enabled: canvasReady,
    portraitRef,
    qrCodeRef: qrCodeStateRef,
    onQrChange: ({ x, y }) => {
      setQrX(x);
      setQrY(y);
    },
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
      orientation: portraitRef.current ? "portrait" : "landscape",
      frameColor: frameColorRef.current,
      qrCode: { enabled: qrEnabled, url: finalQrUrl, x: qrX, y: qrY, size: qrSize, color: qrColor, halo: qrHalo },
    };

    const payload = await payloadForSubmit(raw, imageCache.current);

    // payloadForSubmit rewrites image URLs, so they must be re-cached before
    // the print file is drawn — otherwise the artwork renders blank.
    await preloadAllImages(payload.images, imageCache.current);

    // Production artwork: the real tag, no red guide border, 1200 DPI.
    const printDataUrl = await printFileDataUrl(payload, imageCache.current);

    // Reference mockup: how the tag looks in the customer's hand. Always
    // landscape, because that is the physical tag.
    let mockupDataUrl = "";
    // On a vertical order the customer also gets it upright, as they designed it.
    let mockupUprightDataUrl = "";
    try {
      if (mockupCanvasRef.current) {
        mockupDataUrl = mockupCanvasRef.current.toDataURL("image/jpeg", 0.9);
        if (portraitRef.current) {
          mockupUprightDataUrl = rotatedMockupDataUrl(mockupCanvasRef.current);
        }
      }
    } catch {
      /* mockups are optional */
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
        mockupUpright: mockupUprightDataUrl,
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

  /**
   * Tell WordPress how tall this page actually is.
   *
   * An iframe's height is set by the PARENT document and can never be set by
   * its own content, so no CSS in here can make the embed grow — which is why
   * a fixed, over-large height was the only workaround available before. The
   * page measures itself instead and the parent applies the number, so the
   * embed grows for the vertical editor and shrinks back for the horizontal
   * one, with no inner scrollbar and no dead space at the bottom.
   */
  useEffect(() => {
    let last = 0;

    /**
     * Measure the CONTENT, never scrollHeight.
     *
     * scrollHeight can never report less than the viewport, and inside an
     * iframe the viewport IS the height the parent has already set. So once
     * the parent makes the frame taller than the content, this page measures
     * the frame itself, reports that back, and the height ratchets up and can
     * never come down. That is what left ~640px of white space below the
     * controls: real content 1092px, reported 1729px.
     *
     * The bottom edge of the lowest laid-out element is the content height,
     * and it shrinks again when the customer unticks a box. Fixed and absolute
     * elements are skipped: they are positioned against the viewport, so they
     * would reintroduce exactly the feedback this avoids.
     */
    function contentHeight(): number {
      const body = document.body;
      if (!body) return 0;

      let bottom = 0;
      const walk = (el: Element) => {
        const style = window.getComputedStyle(el);
        if (style.position === "fixed" || style.position === "absolute") return;
        if (style.display === "none") return;
        const rect = el.getBoundingClientRect();
        if (rect.height > 0) {
          bottom = Math.max(bottom, rect.bottom + window.scrollY);
        }
        for (let i = 0; i < el.children.length; i++) walk(el.children[i]);
      };
      walk(body);

      const bodyStyle = window.getComputedStyle(body);
      const marginBottom = parseFloat(bodyStyle.marginBottom) || 0;
      return Math.ceil(bottom + marginBottom);
    }

    function report() {
      const height = contentHeight();
      // A one-pixel jitter would otherwise loop: resize -> report -> resize.
      if (!height || Math.abs(height - last) < 2) return;
      last = height;
      try {
        window.parent.postMessage({ type: "bik_height", height }, "*");
      } catch {
        /* ignore */
      }
    }

    report();

    const observer = new ResizeObserver(report);
    observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);

    // Images and fonts settle after first paint and change the height.
    window.addEventListener("load", report);
    const settle = window.setTimeout(report, 400);

    return () => {
      observer.disconnect();
      window.removeEventListener("load", report);
      window.clearTimeout(settle);
    };
  }, []);

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

  /**
   * There is only ever ONE image on the tag. Adding a new one replaces whatever
   * was there — previously each addition stacked on top of the last and the old
   * one only disappeared on a page refresh.
   *
   * In portrait the canvas is still landscape underneath, so the image is laid
   * on its side (rotation -90) and fitted against swapped dimensions. Seen
   * through the clockwise display rotation, it reads upright.
   */
  async function addUploadedImage(dataUrl: string, naturalW: number, naturalH: number) {
    const upright = portraitRef.current;
    const placement = upright
      ? fitCoverInFrameRotated(naturalW, naturalH)
      : fitCoverInFrame(naturalW, naturalH);
    const img: DesignImage = {
      id: uid(),
      url: dataUrl,
      originalUrl: dataUrl,
      ...placement,
      rotation: upright ? -90 : 0,
    };
    setImages([img]);
    setSelectedBgId(img.id);
  }

  async function addAiImage(url: string) {
    const image = await preloadImage(url, imageCache.current);
    const upright = portraitRef.current;
    const placement = upright
      ? fitCoverInFrameRotated(image.naturalWidth, image.naturalHeight)
      : fitCoverInFrame(image.naturalWidth, image.naturalHeight);
    // Replaces the existing image rather than layering over it.
    const img: DesignImage = { id: uid(), url, ...placement, rotation: upright ? -90 : 0 };
    setImages([img]);
    setSelectedBgId(img.id);
  }

  async function onUpload(file: File) {
    const dataUrl = await fileToDataUrl(file);
    const image = await preloadImage(dataUrl, imageCache.current);
    // Kept before any cropping, so "design it for me" submits the whole picture.
    fullSourceRef.current = dataUrl;
    setFrameColor(frameColorForImage(image));
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
        body: JSON.stringify({
          prompt: aiPrompt,
          orientation: portraitRef.current ? "portrait" : "landscape",
        }),
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
    try {
      setFrameColor(frameColorForImage(await preloadImage(url, imageCache.current)));
    } catch {
      /* keep the previous frame colour */
    }
    await addAiImage(url);
    setFitMode("manual");
    setAiOpen(false);
    setAiLoading(false);
    // The generated set is deliberately NOT cleared. Picking one image used to
    // discard the other two, so changing your mind meant generating again from
    // scratch. They stay until a new set is generated.
  }

  function addTextLine() {
    setShowText(true);
    setTextLines((lines) => [
      ...lines,
      {
        id: uid(),
        text: "",
        fontFamily: "Arial",
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        shadow: { enabled: false, color: "#000000", opacity: 0.5, dx: 6, dy: 6, blur: 8 },
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
        <div className={`preview-wrap${portrait ? " portrait" : ""}`}>
          <div className={`preview-stack${portrait ? " portrait" : ""}`} ref={previewStackRef}>
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
          {images.length > 0 && <p>{labels.hintGestures}</p>}
        </div>
        {/*
          Size bar is always present — it used to appear only once an image
          existed, which made the row jump as soon as one was added. The
          vertical toggle shares the row and must not move.
        */}
        <div className="editor-controls-row">
          <label className="checkbox-row inline">
            <input type="checkbox" checked={portrait} onChange={(e) => setPortrait(e.target.checked)} />
            <span>{extra.verticalHint}</span>
          </label>
          <div className="image-scale-bar">
            <button
              type="button"
              className="btn secondary compact"
              onClick={() => scaleActiveImage(0.9)}
              aria-label={labels.smaller}
              disabled={images.length === 0}
            >
              −
            </button>
            <span className="muted">{labels.imageSize}</span>
            <button
              type="button"
              className="btn secondary compact"
              onClick={() => scaleActiveImage(1.1)}
              aria-label={labels.larger}
              disabled={images.length === 0}
            >
              +
            </button>
          </div>
        </div>
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

        <label className="checkbox-row">
          <input type="checkbox" checked={designForMe} onChange={(e) => setDesignForMe(e.target.checked)} />
          <span>{extra.forMeHint}</span>
        </label>

        <label className="checkbox-row">
          <input type="checkbox" checked={qrEnabled} onChange={(e) => setQrEnabled(e.target.checked)} />
          <span>{extra.qrHint}</span>
        </label>

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
                    {TEXT_FONTS.map((f) => (
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
              </div>

              <div className="text-row text-style-row">
                <button
                  type="button"
                  className={`btn compact${line.bold ? " active" : ""}`}
                  style={{ fontWeight: "bold" }}
                  onClick={() => updateLine(line.id, { bold: !line.bold })}
                  aria-pressed={!!line.bold}
                >
                  B
                </button>
                <button
                  type="button"
                  className={`btn compact${line.italic ? " active" : ""}`}
                  style={{ fontStyle: "italic" }}
                  onClick={() => updateLine(line.id, { italic: !line.italic })}
                  aria-pressed={!!line.italic}
                >
                  I
                </button>
                <button
                  type="button"
                  className={`btn compact${line.underline ? " active" : ""}`}
                  style={{ textDecoration: "underline" }}
                  onClick={() => updateLine(line.id, { underline: !line.underline })}
                  aria-pressed={!!line.underline}
                >
                  U
                </button>
                <button
                  type="button"
                  className={`btn compact${line.strike ? " active" : ""}`}
                  style={{ textDecoration: "line-through" }}
                  onClick={() => updateLine(line.id, { strike: !line.strike })}
                  aria-pressed={!!line.strike}
                >
                  S
                </button>

                <label className="checkbox-row inline shadow-toggle">
                  <input
                    type="checkbox"
                    checked={!!line.shadow?.enabled}
                    onChange={(e) =>
                      updateLine(line.id, {
                        shadow: {
                          color: line.shadow?.color ?? "#000000",
                          opacity: line.shadow?.opacity ?? 0.5,
                          dx: line.shadow?.dx ?? 6,
                          dy: line.shadow?.dy ?? 6,
                          blur: line.shadow?.blur ?? 8,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>{extra.shadowHint}</span>
                </label>
              </div>

              {line.shadow?.enabled && (
                <div className="text-row shadow-row">
                  <div className="field">
                    <label>{extra.shadowColor}</label>
                    <input
                      type="color"
                      value={line.shadow.color}
                      onChange={(e) =>
                        updateLine(line.id, { shadow: { ...line.shadow!, color: e.target.value } })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>{extra.shadowOpacity}</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={line.shadow.opacity}
                      onChange={(e) =>
                        updateLine(line.id, { shadow: { ...line.shadow!, opacity: Number(e.target.value) } })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>{extra.shadowSize}</label>
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={1}
                      value={line.shadow.blur}
                      onChange={(e) =>
                        updateLine(line.id, { shadow: { ...line.shadow!, blur: Number(e.target.value) } })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>{extra.shadowX}</label>
                    <input
                      type="range"
                      min={-60}
                      max={60}
                      step={1}
                      value={line.shadow.dx}
                      onChange={(e) =>
                        updateLine(line.id, { shadow: { ...line.shadow!, dx: Number(e.target.value) } })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>{extra.shadowY}</label>
                    <input
                      type="range"
                      min={-60}
                      max={60}
                      step={1}
                      value={line.shadow.dy}
                      onChange={(e) =>
                        updateLine(line.id, { shadow: { ...line.shadow!, dy: Number(e.target.value) } })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="text-row">
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