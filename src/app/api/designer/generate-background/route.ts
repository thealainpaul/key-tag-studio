import { NextRequest, NextResponse } from "next/server";
import { makePollinationsUrl } from "@/lib/design";

export const maxDuration = 60;

const MODEL = "flux";
const AI_GEN_W = 1280;
const AI_GEN_H = Math.round(AI_GEN_W / (46.0 / 19.9));

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Please enter a description" }, { status: 400 });
  }

  const trimmed = prompt.trim();
  const baseSeed = Math.floor(Math.random() * 900_000) + 1000;
  const baseId = Date.now();

  // Return 3 guest URLs - no auth needed, but subject to rate limiting
  const images = [0, 1, 2].map((i) => ({
    id: `ai-${baseId}-${i}`,
    url: makePollinationsUrl(trimmed, baseSeed + i * 50_000, false, MODEL),
  }));

  return NextResponse.json({ success: true, images });
}
