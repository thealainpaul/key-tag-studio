import { NextRequest, NextResponse } from "next/server";
import { generateImageWithAuth } from "@/lib/design";

export const maxDuration = 60;

const MODEL = "flux";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Please enter a description" }, { status: 400 });
  }

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Server error: POLLINATIONS_API_KEY not configured" },
      { status: 500 }
    );
  }

  const trimmed = prompt.trim();
  const baseSeed = Math.floor(Math.random() * 900_000) + 1000;
  const baseId = Date.now();

  // All 3 fire at once, server-side, using the authenticated key — no per-IP rate limit.
  const results = await Promise.allSettled(
    [0, 1, 2].map((i) => generateImageWithAuth(trimmed, baseSeed + i * 50_000, apiKey, MODEL))
  );

  const images = results.map((r, i) => ({
    id: `ai-${baseId}-${i}`,
    url: r.status === "fulfilled" ? r.value : null,
    error: r.status === "rejected" ? String(r.reason) : undefined,
  }));

  const anyOk = images.some((img) => img.url);
  if (!anyOk) {
    const firstError = images.find((img) => img.error)?.error || "Unknown error";
    return NextResponse.json(
      { success: false, error: `Could not generate any images: ${firstError}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, images });
}
