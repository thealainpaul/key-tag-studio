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
  fitMode?: "auto" | "manual";
};

import { CANVAS_H, CANVAS_W } from "./keytag-shape";

/** Wide banner — similar proportions to the key tag, not exact. */
export const AI_GEN_W = 800;
export const AI_GEN_H = 320;

/** Short Pollinations URL. Long URLs were causing failed requests. */
export function makePollinationsUrl(userPrompt: string, seed: number, simple = false): string {
  const text = simple
    ? `${userPrompt.trim()}, wide banner photo`
    : `${userPrompt.trim()}, wide horizontal banner photo, subject on its side, realistic`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=${AI_GEN_W}&height=${AI_GEN_H}&seed=${seed}&model=turbo&nologo=true`;
}

export function buildAiPrompt(userPrompt: string): string {
  return `${userPrompt.trim()}, wide horizontal banner photo, subject on its side, realistic`;
}

export function pollinationsUrl(
  prompt: string,
  seed: number,
  width = AI_GEN_W,
  height = AI_GEN_H,
  model = "turbo"
) {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true`;
}

export function naturalCenterPlacement(naturalW: number, naturalH: number) {
  return {
    x: (CANVAS_W - naturalW) / 2,
    y: (CANVAS_H - naturalH) / 2,
    width: naturalW,
    height: naturalH,
  };
}
