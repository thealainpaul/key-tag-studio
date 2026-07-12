import { NextRequest, NextResponse } from "next/server";
import { makePollinationsUrl } from "@/lib/design";

export const maxDuration = 300;

const POLLS = 30;
const POLL_MS = 3000; // Faster polling interval

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  const { prompt, seed, model } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Prompt required" }, { status: 400 });
  }

  const s = seed ?? Math.floor(Math.random() * 900_000);
  // Add a unique timestamp to the base URL to force a cache bypass on the Pollinations gateway
  const url = `${makePollinationsUrl(prompt.trim(), s, false, model || "turbo")}&nocache=${Date.now()}`;

  for (let i = 0; i < POLLS; i++) {
    // Add an exponential jitter to stagger the backend requests so they don't hit the IP limit at once
    if (i > 0) await sleep(POLL_MS + Math.random() * 2000);
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(90000),
        headers: { Accept: "image/*" },
      });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") || "";
      if (!type.startsWith("image/")) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 2000) continue;
      const dataUrl = `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
      return NextResponse.json({ success: true, url: dataUrl, pollinationsUrl: url });
    } catch {
      // keep polling
    }
  }

  return NextResponse.json({ success: false, error: "Could not generate" }, { status: 502 });
}
