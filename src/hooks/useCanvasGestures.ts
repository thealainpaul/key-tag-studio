import { useEffect, useRef } from "react";
import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";
import { pinchImageDimensions, pointerDistance, type PinchState } from "@/lib/canvas-gestures";
import { CANVAS_H, CANVAS_W } from "@/lib/keytag-shape";
import { clampQrSize, QR_DEFAULT_PX, qrDefaultCenter } from "@/lib/qrcode-render";

type DragState =
  | { type: "text" | "image" | "qr"; id: string; ox: number; oy: number }
  | { type: "rotate"; id: string; ox: number; oy: number; cx: number; cy: number; start: number };
type PointerPoint = { x: number; y: number };

type Options = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  touchTargetRef?: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
  /** True while the editor is displayed rotated 90 degrees counter-clockwise. */
  portraitRef?: React.MutableRefObject<boolean>;
  imagesRef: React.MutableRefObject<DesignImage[]>;
  textLinesRef: React.MutableRefObject<TextLine[]>;
  /** The QR, so it can be dragged like text and images rather than only nudged. */
  qrCodeRef?: React.MutableRefObject<DesignPayload["qrCode"] | undefined>;
  onQrChange?: (patch: { x: number; y: number }) => void;
  selectedBgIdRef: React.MutableRefObject<string | null>;
  tagColorRef: React.MutableRefObject<string>;
  redrawContent: (images?: DesignImage[], textLines?: TextLine[], tagColor?: string) => void;
  onImagesChange: (images: DesignImage[]) => void;
  onTextLinesChange: (lines: TextLine[]) => void;
  onSelectText?: (id: string) => void;
  /** Id of the selected line, so its rotation handle can be hit-tested. */
  selectedTextIdRef?: React.MutableRefObject<string | null>;
};

const MIN_PINCH_DIST = 24;

export function useCanvasGestures({
  canvasRef,
  touchTargetRef,
  enabled = true,
  portraitRef,
  imagesRef,
  textLinesRef,
  qrCodeRef,
  onQrChange,
  selectedBgIdRef,
  tagColorRef,
  redrawContent,
  onImagesChange,
  onTextLinesChange,
  onSelectText,
  selectedTextIdRef,
}: Options) {
  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const pointersRef = useRef(new Map<number, PointerPoint>());

  /**
   * Screen point to canvas point.
   *
   * In portrait the canvas is displayed rotated 90 degrees CLOCKWISE, which is
   * the direction that puts the ring hole at the top — measured against the
   * mockup asset, not assumed. The browser then reports an axis-aligned box
   * whose width is the canvas's height and vice versa. Clockwise maps canvas
   * (u, v) to screen (1 - v, u); inverting gives u = v', v = 1 - u'. Without
   * this the pointer lands on the wrong axis and drags run sideways.
   */
  function canvasPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;

    if (portraitRef?.current) {
      return { x: v * CANVAS_W, y: (1 - u) * CANVAS_H };
    }
    return { x: u * CANVAS_W, y: v * CANVAS_H };
  }

  function activeImage() {
    return imagesRef.current.find((i) => i.id === selectedBgIdRef.current) || imagesRef.current[0];
  }

  function hitText(ctx: CanvasRenderingContext2D, line: TextLine, x: number, y: number) {
    ctx.font = `${line.fontSize}px "${line.fontFamily}"`;
    const w = ctx.measureText(line.text).width;
    const h = line.fontSize * 1.3;
    return x >= line.x - w / 2 - 16 && x <= line.x + w / 2 + 16 && y >= line.y - h / 2 - 16 && y <= line.y + h / 2 + 16;
  }

  function beginDrag(clientX: number, clientY: number) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const bg = activeImage();
    const { x, y } = canvasPoint(clientX, clientY);
    // QR first: it is drawn on top of everything, so it must be grabbed first.
    // It used to be absent from this hit test entirely, which is why it could
    // only be nudged with the controls while text and images could be dragged.
    const qr = qrCodeRef?.current;
    if (qr?.enabled && qr.url?.trim()) {
      // qr.x / qr.y are the CENTRE, not the top-left - drawQr computes
      // left = centerX - size/2. Treating them as a corner puts this box half a
      // QR down and to the right of the code, so it only catches in the overlap.
      //
      // The size must be the CLAMPED one too, because that is what is drawn.
      const size = clampQrSize(qr.size ?? QR_DEFAULT_PX);
      const fallback = qrDefaultCenter(size);
      const cx = qr.x ?? fallback.x;
      const cy = qr.y ?? fallback.y;
      const half = size / 2;
      if (x >= cx - half && x <= cx + half && y >= cy - half && y <= cy + half) {
        dragRef.current = { type: "qr", id: "qr", ox: x - cx, oy: y - cy };
        return;
      }
    }

    // Rotation handle of the SELECTED line, checked before the text itself so
    // dragging inside the text still moves it. The handle sits outside the
    // glyphs, which is how Figma and Illustrator keep the two apart.
    const selId = selectedTextIdRef?.current;
    if (selId) {
      const sel = textLinesRef.current.find((l) => l.id === selId);
      if (sel?.text.trim()) {
        ctx.font = `${sel.italic ? "italic " : ""}${sel.bold ? "bold " : ""}${sel.fontSize}px "${sel.fontFamily}"`;
        const w = ctx.measureText(sel.text).width;
        const reach = (sel.stacked ? sel.fontSize * 1.2 : w / 2) + sel.fontSize * 0.9;
        const a = ((sel.angle ?? 0) % 360) * (Math.PI / 180);
        const hx = sel.x + Math.cos(a) * reach;
        const hy = sel.y + Math.sin(a) * reach;
        const r = Math.max(sel.fontSize * 0.45, 26);
        if ((x - hx) ** 2 + (y - hy) ** 2 <= r * r) {
          dragRef.current = {
            type: "rotate",
            id: sel.id,
            ox: 0,
            oy: 0,
            cx: sel.x,
            cy: sel.y,
            start: (sel.angle ?? 0) - (Math.atan2(y - sel.y, x - sel.x) * 180) / Math.PI,
          };
          return;
        }
      }
    }

    const hit = [...textLinesRef.current].reverse().find((line) => line.text.trim() && hitText(ctx, line, x, y));

    if (hit) {
      onSelectText?.(hit.id);
      dragRef.current = { type: "text", id: hit.id, ox: x - hit.x, oy: y - hit.y };
      return;
    }
    if (bg) {
      dragRef.current = { type: "image", id: bg.id, ox: x - bg.x, oy: y - bg.y };
    }
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragRef.current) return;
    const { x, y } = canvasPoint(clientX, clientY);

    if (dragRef.current.type === "qr") {
      onQrChange?.({ x: x - dragRef.current.ox, y: y - dragRef.current.oy });
      return;
    }

    if (dragRef.current.type === "rotate") {
      const d = dragRef.current;
      let deg = d.start + (Math.atan2(y - d.cy, x - d.cx) * 180) / Math.PI;
      deg = ((deg % 360) + 360) % 360;
      const next = textLinesRef.current.map((l) => (l.id === d.id ? { ...l, angle: deg } : l));
      textLinesRef.current = next;
      redrawContent();
      return;
    }

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
    if (dragRef.current.type === "qr") {
      dragRef.current = null;
      return;
    }
    if (dragRef.current.type === "rotate") {
      onTextLinesChange([...textLinesRef.current]);
      dragRef.current = null;
      return;
    }
    if (dragRef.current.type === "text") onTextLinesChange([...textLinesRef.current]);
    else onImagesChange([...imagesRef.current]);
    dragRef.current = null;
  }

  function endPinch() {
    if (!pinchRef.current) return;
    onImagesChange([...imagesRef.current]);
    pinchRef.current = null;
  }

  function tryBeginPinch(dist: number) {
    if (dist < MIN_PINCH_DIST) return false;

    dragRef.current = null;
    const bg = activeImage();
    if (!bg) return false;

    pinchRef.current = {
      id: bg.id,
      startDist: dist,
      startW: bg.width,
      startH: bg.height,
      cx: bg.x + bg.width / 2,
      cy: bg.y + bg.height / 2,
    };
    return true;
  }

  function applyPinch(dist: number) {
    const p = pinchRef.current;
    if (!p || dist < MIN_PINCH_DIST) return false;

    const dims = pinchImageDimensions(p, dist);
    const next = imagesRef.current.map((img) => (img.id === p.id ? { ...img, ...dims } : img));
    imagesRef.current = next;
    redrawContent(next, textLinesRef.current, tagColorRef.current);
    return true;
  }

  function activePointerDist() {
    return pointerDistance(pointersRef.current);
  }

  useEffect(() => {
    const touchTarget = touchTargetRef?.current ?? canvasRef.current;
    const canvas = canvasRef.current;
    if (!enabled || !touchTarget || !canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      touchTarget.setPointerCapture(e.pointerId);
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 1) {
        pinchRef.current = null;
        beginDrag(e.clientX, e.clientY);
      } else if (pointersRef.current.size >= 2) {
        tryBeginPinch(activePointerDist());
      }

      if (e.pointerType !== "mouse" && e.cancelable) e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size >= 2) {
        const dist = activePointerDist();
        if (!pinchRef.current) tryBeginPinch(dist);
        else applyPinch(dist);
        if (e.cancelable) e.preventDefault();
        return;
      }

      if (dragRef.current && pointersRef.current.size === 1) {
        moveDrag(e.clientX, e.clientY);
        if (e.pointerType !== "mouse" && e.cancelable) e.preventDefault();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      try {
        touchTarget.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
      if (pointersRef.current.size < 2) endPinch();
      if (pointersRef.current.size === 0) endDrag();
    };

    const onWheel = (e: WheelEvent) => {
      const bg = activeImage();
      if (!bg) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.06 : 0.94;
      const cx = bg.x + bg.width / 2;
      const cy = bg.y + bg.height / 2;
      const width = bg.width * factor;
      const height = bg.height * factor;
      const next = imagesRef.current.map((img) =>
        img.id === bg.id ? { ...img, width, height, x: cx - width / 2, y: cy - height / 2 } : img
      );
      imagesRef.current = next;
      onImagesChange(next);
      redrawContent(next, textLinesRef.current, tagColorRef.current);
    };

    touchTarget.addEventListener("pointerdown", onPointerDown);
    touchTarget.addEventListener("pointermove", onPointerMove);
    touchTarget.addEventListener("pointerup", onPointerUp);
    touchTarget.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      pointersRef.current.clear();
      pinchRef.current = null;
      dragRef.current = null;
      touchTarget.removeEventListener("pointerdown", onPointerDown);
      touchTarget.removeEventListener("pointermove", onPointerMove);
      touchTarget.removeEventListener("pointerup", onPointerUp);
      touchTarget.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [enabled, canvasRef, touchTargetRef, portraitRef, redrawContent, onImagesChange, onTextLinesChange, onSelectText]);

  return {
    beginDrag,
    moveDrag,
    endDrag,
  };
}
