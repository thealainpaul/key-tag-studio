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
  /** Full uncropped upload — kept for admin when customer chose auto-fit. */
  originalUrl?: string;
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

/** Wide banner — similar proportions to the key tag. */
export const AI_GEN_W = 1280;
export const AI_GEN_H = Math.round(AI_GEN_W / (46.0 / 19.9));

/** Short Pollinations URL. Long URLs were causing failed requests. */
export function makePollinationsUrl(
  userPrompt: string,
  seed: number,
  simple = false,
  model = "turbo"
): string {
  const text = simple
    ? `${userPrompt.trim()}, wide banner photo`
    : `${userPrompt.trim()}, wide horizontal banner photo, subject on its side, realistic`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=${AI_GEN_W}&height=${AI_GEN_H}&seed=${seed}&model=${model}&nologo=true`;
}

export function buildAiPrompt(userPrompt: string): string {
  return `${userPrompt.trim()}, wide horizontal banner photo, subject on its side, realistic`;
}

/**
 * Authenticated Pollinations request (gen.pollinations.ai). Used server-side only —
 * requires POLLINATIONS_API_KEY. This is what removes the per-IP rate limit entirely,
 * so all 3 slots can generate at once without lag.
 */
export function makeAuthenticatedPollinationsUrl(
  userPrompt: string,
  seed: number,
  model = "kontext"
): string {
  const text = `${userPrompt.trim()}, wide horizontal banner photo, subject on its side, realistic`;
  const params = new URLSearchParams({
    width: String(AI_GEN_W),
    height: String(AI_GEN_H),
    seed: String(seed),
    model,
    nologo: "true",
  });
  return `https://gen.pollinations.ai/image/${encodeURIComponent(text)}?${params.toString()}`;
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

/** Scale uniformly to cover the frame — edges clip, full image kept for admin. */
export function fitCoverInFrame(naturalW: number, naturalH: number) {
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

/** Scale uniformly to fill the frame width — no stretching. Used for AI picks. */
export function fitWidthInFrame(naturalW: number, naturalH: number) {
  const scale = CANVAS_W / naturalW;
  const width = CANVAS_W;
  const height = naturalH * scale;
  return {
    x: 0,
    y: (CANVAS_H - height) / 2,
    width,
    height,
  };
}
