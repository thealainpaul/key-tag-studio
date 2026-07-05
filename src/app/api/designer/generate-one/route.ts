import { NextRequest, NextResponse } from "next/server";
import { makePollinationsUrl } from "@/lib/design";

export const maxDuration = 300;

const POLLS = 30;
const POLL_MS = 5000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  const { prompt, seed } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Prompt required" }, { status: 400 });
  }

  const s = seed ?? Math.floor(Math.random() * 900_000);
  const url = makePollinationsUrl(prompt.trim(), s);

  for (let i = 0; i < POLLS; i++) {
    if (i > 0) await sleep(POLL_MS);
    try {
      const res = await fetch(`${url}&_=${Date.now()}`, {
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
