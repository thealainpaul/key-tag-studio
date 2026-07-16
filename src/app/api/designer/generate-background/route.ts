import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ success: false, error: "Please enter a description" }, { status: 400 });

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, error: "API key not set" }, { status: 500 });

  const baseSeed = Math.floor(Math.random() * 900_000) + 1000;
  const baseId = Date.now();
  const text = `${prompt.trim()}, wide horizontal banner photo, subject on its side, realistic`;

  const images = await Promise.all(
    [0, 1, 2].map(async (i) => {
      try {
        const url = `https://gen.pollinations.ai/image/${encodeURIComponent(text)}?width=1280&height=539&seed=${baseSeed + i * 50_000}&model=flux&nologo=true&key=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
        if (!res.ok) throw new Error("fetch failed");
        const buf = await res.arrayBuffer();
        return { id: `ai-${baseId}-${i}`, url: `data:image/png;base64,${Buffer.from(buf).toString("base64")}` };
      } catch {
        return { id: `ai-${baseId}-${i}`, url: null };
      }
    })
  );

  return NextResponse.json({ success: true, images });
}
