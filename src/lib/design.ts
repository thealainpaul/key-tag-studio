import { KEYTAG_SPECS } from "@/lib/keytag-shape";
export type TextLine = {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  x: number;
  y: number;
  linkedImageId: string | null;
  /** Styling. Optional so designs saved before these existed still load. */
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /**
   * Drop shadow. Because the colour is free, a light colour turns it into a
   * glow or a light source rather than a shadow.
   */
  shadow?: {
    enabled: boolean;
    color: string;
    opacity: number;
    /** Offset in canvas px, so it scales with the tag. */
    dx: number;
    dy: number;
    /** Blur radius in canvas px. */
    blur: number;
  };
  /**
   * Rotation in degrees, 0-360, about the line's own centre.
   *
   * ONE value covers every case: 0 is normal, 90 reads along the tag, and
   * anything between sets it diagonally. The preset buttons write into this
   * same number rather than running a second system beside it.
   */
  angle?: number;
  /**
   * Stack the letters downward with each one UPRIGHT, rather than rotating the
   * whole line. This is a different layout, not a rotation, which is why it is
   * a separate flag and not another angle.
   */
  stacked?: boolean;
  /** Tracking, in canvas px, added between letters. Negative tightens. */
  letterSpacing?: number;
};

/**
 * Sans-serif faces only. The manufacturer was explicit: "Bei Schriften sollte,
 * aufgrund der Lesbarkeit, auf eine Darstellung mit Serifen verzichtet werden."
 * At 17.9 mm tall, serifs fill in.
 *
 * These are the widely available sans-serif families, so they render on the
 * customer's machine without a web-font download. Do not add a serif face.
 */
export const TEXT_FONTS = [
  "Arial",
  "Helvetica",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Segoe UI",
  "Calibri",
  "Candara",
  "Corbel",
  "Franklin Gothic Medium",
  "Century Gothic",
  "Gill Sans",
  "Futura",
  "Optima",
  "Avenir",
  "Lucida Sans",
  "Geneva",
  "Impact",
  "Haettenschweiler",
  "Arial Black",
  "Arial Narrow",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Oswald",
  "Poppins",
  "Raleway",
  "Nunito",
  "Work Sans",
  "Inter",
  "Source Sans 3",
  "PT Sans",
  "Fira Sans",
  "Rubik",
  "Barlow",
  "Manrope",
  "DM Sans",
  "Karla",
  "Mulish",
];

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
  /**
   * Customer ticked "design it for me". When true the studio also submits the
   * full-size source image, so BIK can place it in the editor on their behalf.
   */
  designForMe?: boolean;
  /**
   * How the customer was working. Design coordinates are ALWAYS stored in the
   * tag's native landscape space regardless — "portrait" only changes what the
   * customer sees and how images sit within that space, so the print file the
   * manufacturer receives never changes shape.
   */
  orientation?: "landscape" | "portrait";
  /** Bleed frame colour, derived from the customer's image. */
  frameColor?: string;
  qrCode?: {
    enabled: boolean;
    url: string;
    /** Centre point, in canvas px. Defaults to the old right-hand position. */
    x?: number;
    y?: number;
    /** Width/height of the QR square, in canvas px. */
    size?: number;
    /** Module colour. Light modules are transparent — no backing panel. */
    color?: string;
    /** Soft quiet-zone glow behind the code. Off = nothing behind the modules. */
    halo?: boolean;
  };
};

import { BLEED_CANVAS_H, BLEED_CANVAS_W, CANVAS_H, CANVAS_W } from "./keytag-shape";

/**
 * Ask for the full print file size, bleed included — 2173 x 940.
 *
 * This was 1280 x 521, which was then blown up to fill 2079 x 846. Measured, the
 * real detail that gave across the printed width was 886.58 dpi against the
 * 1200 the manufacturer requires, and his email says plainly that upscaling does
 * not count.
 *
 * Pollinations does not honour these numbers exactly — it snaps to its own
 * bucket for the requested shape. Measured with model seedream-5-pro, asking for
 * 2173 x 940 returns 3056 x 1312, which is 1.9629x the 2,042,620 px needed, so
 * the image is DOWNSCALED to fit and lands at 1674.89 dpi. The old flux model
 * was capped at 1536 x 640 no matter what was asked for, which is where the
 * 886.58 came from.
 */
export const AI_GEN_W = BLEED_CANVAS_W;
export const AI_GEN_H = BLEED_CANVAS_H;

/** Portrait equivalent — the same pixels, tall instead of wide. */
export const AI_GEN_PORTRAIT_W = AI_GEN_H;
export const AI_GEN_PORTRAIT_H = AI_GEN_W;

/**
 * The AI must be told which shape it is composing into. Asked for a wide banner
 * and shown upright, the subject ends up cropped away.
 *
 * It is NOT told about the 80% ink ceiling. Words like "80% grey" read to the
 * model as a styling instruction and it started returning pictures with grey
 * and black backgrounds. The ceiling is applied to the pixels afterwards by
 * applyInkCeiling, so the model has no need to know about it.
 */

/**
 * The manufacturer's 80% black rule.
 *
 * "Barcodes, oder deren Hintergruende sollten grundsaetzlich, wie auch
 * Schriften, auf 80% schwarz, also Grau, gestaltet werden" and "Grundflaeche
 * nicht schwarz 80% (grau) gestellt".
 *
 * 80% black means 80% ink, so 20% of the paper still shows: the darkest tone
 * printed is 20% of full brightness. On screen that is 0.20 * 255 = 51.
 * Nothing may go darker than this - not the tag colour, not the QR, not the
 * text, and not a photograph the customer uploads.
 */
export const MAX_INK = 0.8;
export const MIN_CHANNEL = Math.round(255 * (1 - MAX_INK));

/** Lift a single 0-255 channel so it never prints darker than 80% ink. */
export function liftChannel(v: number): number {
  return MIN_CHANNEL + (v / 255) * (255 - MIN_CHANNEL);
}

/**
 * Lift a CSS colour to the 80% ink ceiling, keeping its hue.
 *
 * Accepts #rgb, #rrggbb and rgb()/rgba(). Anything else is returned untouched
 * rather than guessed at.
 */
export function liftColor(css: string): string {
  const hex = css.trim();
  let r: number, g: number, b: number;
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (/^#[0-9a-f]{6}$/i.test(hex)) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else {
    const m = hex.match(/rgba?\(([^)]+)\)/i);
    if (!m) return css;
    const parts = m[1].split(",").map((n) => parseFloat(n));
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return css;
    [r, g, b] = parts;
  }
  const to = (v: number) => Math.round(liftChannel(v)).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function aiPromptSuffix(orientation: "landscape" | "portrait"): string {
  return orientation === "portrait"
    ? "tall vertical banner photo, subject upright, realistic"
    : "wide horizontal banner photo, subject on its side, realistic";
}

/**
 * Short Pollinations URL. Long URLs were causing failed requests.
 *
 * Takes the orientation so the vertical editor gets a PORTRAIT image. The tag
 * is 44.0 x 17.9 mm, so landscape is 1280 x 521 and portrait is that swapped.
 * Asking for a wide banner and then showing it upright crops the subject away.
 *
 * Uses the same aiPromptSuffix as the main route, so both ask for the same
 * thing. Neither mentions the ink ceiling - that is applied to the pixels
 * later, and putting it in the prompt made the model draw grey backgrounds.
 */
export function makePollinationsUrl(
  userPrompt: string,
  seed: number,
  simple = false,
  model = "turbo",
  orientation: "landscape" | "portrait" = "landscape"
): string {
  const text = simple
    ? `${userPrompt.trim()}, ${orientation === "portrait" ? "tall" : "wide"} banner photo`
    : `${userPrompt.trim()}, ${aiPromptSuffix(orientation)}`;
  const w = orientation === "portrait" ? AI_GEN_PORTRAIT_W : AI_GEN_W;
  const h = orientation === "portrait" ? AI_GEN_PORTRAIT_H : AI_GEN_H;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=${w}&height=${h}&seed=${seed}&model=${model}&nologo=true`;
}

export function buildAiPrompt(userPrompt: string): string {
  return `${userPrompt.trim()}, wide horizontal banner photo, subject on its side, realistic`;
}

/**
 * Authenticated Pollinations request (gen.pollinations.ai/v1). Used server-side only —
 * requires POLLINATIONS_API_KEY. This is what removes the per-IP rate limit entirely,
 * so all 3 slots can generate at once without lag.
 */
export async function generateImageWithAuth(
  prompt: string,
  seed: number,
  apiKey: string,
  model = "flux"
): Promise<string> {
  const text = `${prompt.trim()}, wide horizontal banner photo, subject on its side, realistic`;

  const res = await fetch("https://gen.pollinations.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: text,
      model,
      size: "1280x539",
      response_format: "b64_json",
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error("[pollinations] HTTP error", res.status, bodyText.slice(0, 500));
    throw new Error(`Pollinations returned HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
  }

  const data = (await res.json()) as { data?: Array<{ b64_json: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    console.error("[pollinations] no b64_json in response", JSON.stringify(data).slice(0, 200));
    throw new Error("No image data in Pollinations response");
  }

  return `data:image/png;base64,${b64}`;
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

/**
 * Cover the frame with the image turned 90 degrees.
 *
 * Used when the customer works upright. The canvas stays landscape, so an
 * upright picture must lie on its side within it to read upright on screen.
 * Rotation happens about the image centre, so centring the unrotated box also
 * centres the rotated footprint — only the cover scale accounts for the swap.
 */
export function fitCoverInFrameRotated(naturalW: number, naturalH: number) {
  const scale = Math.max(CANVAS_W / naturalH, CANVAS_H / naturalW);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return {
    x: (CANVAS_W - width) / 2,
    y: (CANVAS_H - height) / 2,
    width,
    height,
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

/** Scale to fit within a bounded area without cropping. Used for QR panel layout. */
export function fitContainInArea(
  naturalW: number,
  naturalH: number,
  areaX: number,
  areaY: number,
  areaWidth: number,
  areaHeight: number
) {
  const scale = Math.min(areaWidth / naturalW, areaHeight / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return {
    x: areaX + (areaWidth - width) / 2,
    y: areaY + (areaHeight - height) / 2,
    width,
    height,
  };
}