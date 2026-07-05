import { NextRequest, NextResponse } from "next/server";
import { makePollinationsUrl } from "@/lib/design";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Please enter a description" }, { status: 400 });
  }

  const trimmed = prompt.trim();
  const baseSeed = Math.floor(Math.random() * 900_000) + 1000;
  const baseId = Date.now();

  const images = [0, 1, 2].map((i) => ({
    id: `ai-${baseId}-${i}`,
    url: makePollinationsUrl(trimmed, baseSeed + i * 50_000),
  }));

  return NextResponse.json({ success: true, images });
}
