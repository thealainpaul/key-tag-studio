import { useEffect, useRef } from "react";
import type { DesignImage, TextLine } from "@/lib/design";
import { touchDistance, type PinchState } from "@/lib/canvas-gestures";
import { CANVAS_H, CANVAS_W } from "@/lib/keytag-shape";

type DragState = { type: "text" | "image"; id: string; ox: number; oy: number };

type Options = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  imagesRef: React.MutableRefObject<DesignImage[]>;
  textLinesRef: React.MutableRefObject<TextLine[]>;
  selectedBgIdRef: React.MutableRefObject<string | null>;
  tagColorRef: React.MutableRefObject<string>;
  redrawContent: (images?: DesignImage[], textLines?: TextLine[], tagColor?: string) => void;
  onImagesChange: (images: DesignImage[]) => void;
  onTextLinesChange: (lines: TextLine[]) => void;
  onSelectText?: (id: string) => void;
};

export function useCanvasGestures({
  canvasRef,
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        dragRef.current = null;
        const bg = activeImage();
        if (!bg) return;
        const dist = touchDistance(e.touches);
        if (dist < 10) return;
        pinchRef.current = {
          id: bg.id,
          startDist: dist,
          startW: bg.width,
          startH: bg.height,
          cx: bg.x + bg.width / 2,
          cy: bg.y + bg.height / 2,
        };
        return;
      }
      if (e.touches.length === 1) {
        pinchRef.current = null;
        beginDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dist = touchDistance(e.touches);
        const p = pinchRef.current;
        const scale = dist / p.startDist;
        const width = p.startW * scale;
        const height = p.startH * scale;
        const next = imagesRef.current.map((img) =>
          img.id === p.id
            ? { ...img, width, height, x: p.cx - width / 2, y: p.cy - height / 2 }
            : img
        );
        imagesRef.current = next;
        redrawContent(next, textLinesRef.current, tagColorRef.current);
        return;
      }
      if (dragRef.current && e.touches.length === 1) {
        e.preventDefault();
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) endPinch();
      if (e.touches.length === 0) endDrag();
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

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [canvasRef, redrawContent, onImagesChange, onTextLinesChange, onSelectText]);

  return {
    beginDrag,
    moveDrag,
    endDrag,
  };
}
