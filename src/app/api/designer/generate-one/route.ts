import { NextRequest, NextResponse } from "next/server";
import { makePollinationsUrl } from "@/lib/design";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { prompt, seed, model, slotNumber } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Prompt required" }, { status: 400 });
  }

  const s = seed ?? Math.floor(Math.random() * 900_000);
  const lane = slotNumber || 1;
  const url = makePollinationsUrl(prompt.trim(), s, false, model || "turbo");

  // We append the lane to the URL so the AI engine sees it as a distinct request.
  return NextResponse.json({ success: true, url: `${url}&lane=${lane}&_=${Date.now()}` });
}
