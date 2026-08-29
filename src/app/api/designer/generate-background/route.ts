import { NextRequest, NextResponse } from "next/server";
import {
  AI_GEN_H,
  AI_GEN_PORTRAIT_H,
  AI_GEN_PORTRAIT_W,
  AI_GEN_W,
  aiPromptSuffix,
} from "@/lib/design";

type Orientation = "landscape" | "portrait";

export const maxDuration = 60;

// Exponential backoff retry logic - FAST delays
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

async function generateImage(
  prompt: string,
  seed: number,
  apiKey: string,
  orientation: Orientation
): Promise<string> {
  const text = `${prompt.trim()}, ${aiPromptSuffix(orientation)}`;
  const encoded = encodeURIComponent(text);
  // Upright tag means an upright picture — asking for a wide banner and then
  // showing it vertically crops the subject away.
  const w = orientation === "portrait" ? AI_GEN_PORTRAIT_W : AI_GEN_W;
  const h = orientation === "portrait" ? AI_GEN_PORTRAIT_H : AI_GEN_H;
  // seedream-5-pro, not flux. flux is capped at 1536 x 640 whatever is asked for
  // (measured: 2079x846, 3072x1250 and 1536x625 all returned 1536 x 640), which
  // is 886.58 dpi once stretched across the tag. seedream-5-pro returns
  // 3056 x 1312 for the same request - enough to DOWNSCALE into the print file.
  const url = `https://gen.pollinations.ai/image/${encoded}?width=${w}&height=${h}&seed=${seed}&model=seedream-5-pro&nologo=true&key=${apiKey}`;

  return retryWithBackoff(async () => {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = await res.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
  });
}

export async function POST(req: NextRequest) {
  const { prompt, orientation: rawOrientation } = await req.json();
  const orientation: Orientation = rawOrientation === "portrait" ? "portrait" : "landscape";
  if (!prompt?.trim()) return NextResponse.json({ success: false, error: "Please enter a description" }, { status: 400 });

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, error: "API key not set" }, { status: 500 });

  const baseSeed = Math.floor(Math.random() * 900_000) + 1000;
  const baseId = Date.now();

  const results = await Promise.allSettled(
    [0, 1, 2].map((i) => generateImage(prompt, baseSeed + i * 50_000, apiKey, orientation))
  );

  const images = results.map((r, i) => ({ id: `ai-${baseId}-${i}`, url: r.status === "fulfilled" ? r.value : null }));

  return NextResponse.json({ success: true, images });
}
