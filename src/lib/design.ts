export type TextLine = {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  x: number;
  y: number;
  linkedImageId: string | null;
};

export type DesignImage = {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type DesignPayload = {
  tagColor: string;
  images: DesignImage[];
  textLines: TextLine[];
  backgroundImageId: string | null;
};

import { CANVAS_H, CANVAS_W } from "./keytag-shape";

export function pollinationsUrl(
  prompt: string,
  seed: number,
  width = CANVAS_W,
  height = CANVAS_H,
  model = "turbo"
) {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&model=${model}`;
}

/** Cover-fit image dimensions centered within the tag canvas. */
export function coverFitInCanvas(naturalW: number, naturalH: number) {
  const scale = Math.max(CANVAS_W / naturalW, CANVAS_H / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return {
    x: (CANVAS_W - width) / 2,
    y: (CANVAS_H - height) / 2,
    width,
    height,
  };
}
