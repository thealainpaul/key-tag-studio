import { NextRequest, NextResponse } from "next/server";
import { pollinationsUrl } from "@/lib/design";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Please enter a description for your background" }, { status: 400 });
  }

  const seeds = [101, 202, 303];
  const images = seeds.map((seed, i) => ({
    url: pollinationsUrl(prompt.trim(), seed),
    id: `ai-${Date.now()}-${i}`,
  }));

  return NextResponse.json({ success: true, images });
}
