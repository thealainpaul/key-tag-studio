import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Simple queue implementation for rate limiting
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private concurrency: number;
  private activeRequests = 0;

  constructor(concurrency: number = 1) {
    this.concurrency = concurrency;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.activeRequests >= this.concurrency) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.concurrency) {
      this.activeRequests++;
      const fn = this.queue.shift();
      if (fn) {
        try {
          await fn();
        } finally {
          this.activeRequests--;
        }
      }
    }

    this.processing = false;
    if (this.queue.length > 0) {
      this.process();
    }
  }
}

// Global queue instance - limits concurrent Pollinations requests
const imageQueue = new RequestQueue(1); // Sequential: 1 request at a time

// Exponential backoff retry logic
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries - 1} after ${delayMs}ms. Error: ${lastError.message}`
        );
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
        // Use headers instead of URL parameters for API key
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

  try {
    // Queue each image request sequentially to avoid rate limits
    // This prevents hammering Pollinations with parallel requests
    const images = [];
    
    for (let i = 0; i < 3; i++) {
      try {
        const url = await imageQueue.add(() =>
          generateImage(prompt, baseSeed + i * 50_000, apiKey)
        );
        images.push({ id: `ai-${baseId}-${i}`, url });
      } catch (error) {
        // If one image fails after retries, mark it as failed but continue
        console.error(`Image ${i} generation failed:`, error);
        images.push({ 
          id: `ai-${baseId}-${i}`, 
          url: null,
          error: error instanceof Error ? error.message : "Generation failed"
        });
      }
    }

    // Return success even if some images failed (client can handle partial results)
    return NextResponse.json({ 
      success: true, 
      images,
      // Return warning if any images failed
      ...(images.some(img => !img.url) && { 
        warning: "Some images failed to generate. Please try again." 
      })
    });
  } catch (error) {
    console.error("Critical error in image generation:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Image generation failed"
      },
      { status: 500 }
    );
  }
}
