import { NextRequest, NextResponse } from "next/server";
import { makePollinationsUrl } from "@/lib/design";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { prompt, seed, model } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Prompt required" }, { status: 400 });
  }

  const s = seed ?? Math.floor(Math.random() * 900_000);
  // We simply generate the URL. The browser will fetch the image directly, 
  // bypassing our server's download bottleneck.
  const url = makePollinationsUrl(prompt.trim(), s, false, model || "turbo");

  return NextResponse.json({ success: true, url: `${url}&_=${Date.now()}` });
}
