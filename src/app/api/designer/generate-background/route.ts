import { NextRequest, NextResponse } from "next/server";
import { pollinationsUrl } from "@/lib/design";

export const maxDuration = 120;

const AI_W = 1086;
const AI_H = 470;
const SEEDS = [101, 202, 303];

async function fetchOne(prompt: string, seed: number): Promise<string | null> {
  const url = pollinationsUrl(prompt, seed, AI_W, AI_H);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) continue;
      const type = res.headers.get("content-type") || "image/jpeg";
      return `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
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
  const images: { url: string; id: string }[] = [];

  for (let i = 0; i < SEEDS.length; i++) {
    const url = await fetchOne(trimmed, SEEDS[i]);
    if (url) images.push({ url, id: `ai-${Date.now()}-${i}` });
  }

  if (images.length === 0) {
    return NextResponse.json({ success: false, error: "Could not generate images. Try again." }, { status: 502 });
  }

  return NextResponse.json({ success: true, images });
}
