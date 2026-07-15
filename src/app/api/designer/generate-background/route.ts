import { NextRequest, NextResponse } from "next/server";
import { makeAuthenticatedPollinationsUrl } from "@/lib/design";

export const maxDuration = 60;

const MODEL = "flux";

async function fetchOneImage(prompt: string, seed: number): Promise<string> {
  const url = makeAuthenticatedPollinationsUrl(prompt, seed, MODEL);
  const apiKey = process.env.POLLINATIONS_API_KEY;

  const res = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    throw new Error(`Pollinations returned HTTP ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 500) {
    throw new Error("Image response too small — likely an error page, not an image");
  }
  return `data:${contentType};base64,${Buffer.from(buf).toString("base64")}`;
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Please enter a description" }, { status: 400 });
  }

  const trimmed = prompt.trim();
  const baseSeed = Math.floor(Math.random() * 900_000) + 1000;
  const baseId = Date.now();

  // All 3 fire at once, server-side, using the authenticated key — no per-IP rate limit.
  const results = await Promise.allSettled(
    [0, 1, 2].map((i) => fetchOneImage(trimmed, baseSeed + i * 50_000))
  );

  const images = results.map((r, i) => ({
    id: `ai-${baseId}-${i}`,
    url: r.status === "fulfilled" ? r.value : null,
    error: r.status === "rejected" ? String(r.reason) : undefined,
  }));

  const anyOk = images.some((img) => img.url);
  if (!anyOk) {
    return NextResponse.json(
      { success: false, error: "Could not generate any images. Check POLLINATIONS_API_KEY is set." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, images });
}
