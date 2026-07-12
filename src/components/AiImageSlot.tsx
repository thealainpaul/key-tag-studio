"use client";

import { useEffect, useState } from "react";
import { type AiProvider, serverEndpoint, slotLoadingHint } from "@/lib/ai-providers";
import { makePollinationsUrl } from "@/lib/design";

type Props = {
  id: string;
  slotNumber?: number;
  provider: AiProvider;
  model: string;
  prompt: string;
  seed: number;
  active: boolean;
  waitBeforeStart: number; // Added this
  onUpdate: (slot: any) => void;
  onPick: (url: string) => void;
};

export default function AiImageSlot({ id, slotNumber, provider, model, prompt, seed, active, waitBeforeStart, onUpdate, onPick }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!active) return;
    setStatus("loading");
    setImgUrl(null);

    const timer = setTimeout(async () => {
      try {
        if (provider === "pollinations-browser") {
          const url = makePollinationsUrl(prompt, seed, false, model);
          setImgUrl(`${url}&_=${Date.now()}`);
          setStatus("ok");
        } else {
          const res = await fetch(serverEndpoint(provider)!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, seed, model, slotNumber }),
          });
          const data = await res.json();
          if (data.success) {
            setImgUrl(data.url);
            setStatus("ok");
          } else {
            throw new Error();
          }
        }
      } catch {
        setStatus("error");
      }
    }, waitBeforeStart);

    return () => clearTimeout(timer);
  }, [active, provider, prompt, seed, model, id, waitBeforeStart, slotNumber]);

  return (
    <div className={`ai-slot ai-slot-${status}`}>
      {imgUrl ? (
        <img
          src={imgUrl}
          onClick={() => onPick(imgUrl)}
          style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
        />
      ) : (
        <span className="ai-slot-msg">{slotNumber ? slotLoadingHint(slotNumber) : "Generating…"}</span>
      )}
    </div>
  );
}
