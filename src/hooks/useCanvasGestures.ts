import { useEffect, useRef } from "react";
import type { DesignImage, TextLine } from "@/lib/design";
import { pinchImageDimensions, pointerDistance, type PinchState } from "@/lib/canvas-gestures";
import { CANVAS_H, CANVAS_W } from "@/lib/keytag-shape";

type DragState = { type: "text" | "image"; id: string; ox: number; oy: number };
type PointerPoint = { x: number; y: number };

type Options = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  touchTargetRef?: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
  imagesRef: React.MutableRefObject<DesignImage[]>;
  textLinesRef: React.MutableRefObject<TextLine[]>;
  selectedBgIdRef: React.MutableRefObject<string | null>;
  tagColorRef: React.MutableRefObject<string>;
  redrawContent: (images?: DesignImage[], textLines?: TextLine[], tagColor?: string) => void;
  onImagesChange: (images: DesignImage[]) => void;
  onTextLinesChange: (lines: TextLine[]) => void;
  onSelectText?: (id: string) => void;
};

const MIN_PINCH_DIST = 24;

export function useCanvasGestures({
  canvasRef,
  touchTargetRef,
  enabled = true,
  imagesRef,
  textLinesRef,
  selectedBgIdRef,
  tagColorRef,
  redrawContent,
  onImagesChange,
  onTextLinesChange,
  onSelectText,
}: Options) {
  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const pointersRef = useRef(new Map<number, PointerPoint>());

  function canvasPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H,
    };
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
  }, [enabled, canvasRef, touchTargetRef, redrawContent, onImagesChange, onTextLinesChange, onSelectText]);

  return {
    beginDrag,
    moveDrag,
    endDrag,
  };
}
