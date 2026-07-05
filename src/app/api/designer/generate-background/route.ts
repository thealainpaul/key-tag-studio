import { NextRequest, NextResponse } from "next/server";
import { pollinationsUrl } from "@/lib/design";

export const maxDuration = 120;

const AI_W = 512;
const AI_H = 221;
const SEEDS = [101, 202, 303];
const MODELS = ["turbo", "turbo", "flux"] as const;
const STAGGER_MS = 2000;
const MAX_ATTEMPTS = 4;

function backoffMs(attempt: number) {
  return 1500 * Math.pow(2, attempt);
}

async function fetchOne(prompt: string, seed: number, model: string): Promise<string | null> {
  const url = pollinationsUrl(prompt, seed, AI_W, AI_H, model);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, backoffMs(attempt - 1)));

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) continue;
      const type = res.headers.get("content-type") || "image/jpeg";
      return `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
    } catch {
      // retry with backoff
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Please enter a description" }, { status: 400 });
  }

  const trimmed = prompt.trim();
  const baseId = Date.now();

  const results = await Promise.all(
    SEEDS.map((seed, i) =>
      (async () => {
        await new Promise((r) => setTimeout(r, i * STAGGER_MS));
        const url = await fetchOne(trimmed, seed, MODELS[i]);
        return {
          id: `ai-${baseId}-${i}`,
          url,
          error: url ? undefined : "Could not generate this option",
        };
      })()
    )
  );

  const okCount = results.filter((r) => r.url).length;
  if (okCount === 0) {
    return NextResponse.json(
      { success: false, error: "Could not generate images. Try again.", images: results },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, images: results });
}
