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
  qrCode?: { enabled: boolean; url: string };
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
 * Authenticated Pollinations request (gen.pollinations.ai/v1). Used server-side only —
 * requires
