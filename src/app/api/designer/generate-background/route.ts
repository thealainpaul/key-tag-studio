import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const MODEL = "flux";
const AI_GEN_W = 1280;
const AI_GEN_H = Math.round(AI_GEN_W / (46.0 / 19.9));

async function generateImage(prompt: string, seed: number, apiKey: string): Promise<string> {
  const text = `${prompt.trim()}, wide horizontal banner photo, subject on its side, realistic`;
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(text)}?width=${AI_GEN_W}&height=${AI_GEN_H}&seed=${seed}&model=${MODEL}&nologo=true&key=${apiKey}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(45000) });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const buf = await res.arrayBuffer();
  return `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Please enter a description" }, { status: 400 });
  }

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "API key not configured" }, { status: 500 });
  }

  const baseSeed = Math.floor(Math.random() * 900_000) + 1000;
  const baseId = Date.now();

  const results = await Promise.allSettled([0, 1, 2].map((i) => generateImage(prompt, baseSeed + i * 50_000, apiKey)));

  const images = results.map((r, i) => ({
    id: `ai-${baseId}-${i}`,
    url: r.status === "fulfilled" ? r.value : null,
  }));

  return NextResponse.json({ success: true, images });
}
