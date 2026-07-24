import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Exponential backoff retry logic - FAST delays
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

async function generateImage(
  prompt: string,
  seed: number,
  apiKey: string
): Promise<string> {
  const text = `${prompt.trim()}, wide horizontal banner photo, subject on its side, realistic`;
  const encoded = encodeURIComponent(text);

  return retryWithBackoff(async () => {
    const url = `https://gen.pollinations.ai/image/${encoded}?width=1280&height=539&seed=${seed}&model=flux&nologo=true`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error(`Rate limited (429): ${res.statusText}`);
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const buf = await res.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
  });
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  
  if (!prompt?.trim()) {
    return NextResponse.json(
      { success: false, error: "Please enter a description" },
      { status: 400 }
    );
  }

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "API key not configured" },
      { status: 500 }
    );
  }

  const baseSeed = Math.floor(Math.random() * 900_000) + 1000;
  const baseId = Date.now();

  const results = await Promise.allSettled([0, 1, 2].map((i) => 
    generateImage(prompt, baseSeed + i * 50_000, apiKey)
  ));

  const images = results.map((r, i) => ({ 
    id: `ai-${baseId}-${i}`, 
    url: r.status === "fulfilled" ? r.value : null 
  }));

  return NextResponse.json({ success: true, images });
}
