import { NextRequest, NextResponse } from "next/server";
import { AI_GEN_H, AI_GEN_W, buildAiPrompt } from "@/lib/design";

export const maxDuration = 300;

const HORDE_API = "https://stablehorde.net/api/v2";
const HORDE_KEY = process.env.HORDE_API_KEY || "0000000000";
const CHECK_MS = 3000;
const MAX_CHECKS = 90;

/** Horde requires dimensions divisible by 64. */
const HORDE_W = Math.round(AI_GEN_W / 64) * 64;
const HORDE_H = Math.round(AI_GEN_H / 64) * 64;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  const { prompt, seed } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ success: false, error: "Prompt required" }, { status: 400 });
  }

  const s = seed ?? Math.floor(Math.random() * 900_000);
  const headers = { "Content-Type": "application/json", apikey: HORDE_KEY };

  try {
    const submit = await fetch(`${HORDE_API}/generate/async`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: buildAiPrompt(prompt.trim()),
        params: {
          width: HORDE_W,
          height: HORDE_H,
          steps: 25,
          cfg_scale: 7.5,
          sampler_name: "k_euler_a",
          seed: String(s),
        },
        nsfw: true,
        trusted_workers: false,
        slow_workers: true,
        censor_nsfw: false,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!submit.ok) {
      return NextResponse.json({ success: false, error: "Horde queue unavailable" }, { status: 502 });
    }

    const { id } = (await submit.json()) as { id?: string };
    if (!id) {
      return NextResponse.json({ success: false, error: "Horde did not return a job id" }, { status: 502 });
    }

    for (let i = 0; i < MAX_CHECKS; i++) {
      if (i > 0) await sleep(CHECK_MS);
      const check = await fetch(`${HORDE_API}/generate/check/${id}`, {
        headers: { apikey: HORDE_KEY },
        signal: AbortSignal.timeout(30000),
      });
      if (!check.ok) continue;
      const checkData = (await check.json()) as { done?: boolean };
      if (!checkData.done) continue;

      const status = await fetch(`${HORDE_API}/generate/status/${id}`, {
        headers: { apikey: HORDE_KEY },
        signal: AbortSignal.timeout(60000),
      });
      if (!status.ok) break;
      const statusData = (await status.json()) as { generations?: { img?: string }[] };
      const b64 = statusData.generations?.[0]?.img;
      if (!b64) break;

      return NextResponse.json({
        success: true,
        url: `data:image/webp;base64,${b64}`,
      });
    }

    return NextResponse.json({ success: false, error: "Horde timed out — try again" }, { status: 504 });
  } catch {
    return NextResponse.json({ success: false, error: "Horde request failed" }, { status: 502 });
  }
}
