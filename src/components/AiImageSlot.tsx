"use client";

import { useEffect, useState } from "react";
import { type AiProvider, serverEndpoint, slotLoadingHint } from "@/lib/ai-providers";
import { makePollinationsUrl } from "@/lib/design";

export type AiSlotResult = {
  id: string;
  url: string | null;
  status: "loading" | "ok" | "error";
};

type Props = {
  id: string;
  slotNumber?: number;
  provider: AiProvider;
  model: string;
  prompt: string;
  seed: number;
  active: boolean;
  waitBeforeStart: number;
  onUpdate: (slot: AiSlotResult) => void;
  onPick: (url: string) => void;
};

export default function AiImageSlot({ id, slotNumber, provider, model, prompt, seed, active, waitBeforeStart, onUpdate, onPick }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!active) return;
    setStatus("loading");
    setImgUrl(null);
    onUpdate({ id, url: null, status: "loading" });

    const timer = setTimeout(async () => {
      try {
        if (provider === "pollinations-browser") {
          const url = makePollinationsUrl(prompt, seed, false, model);
          const finalUrl = `${url}&_=${Date.now()}`;
          setImgUrl(finalUrl);
          setStatus("ok");
          onUpdate({ id, url: finalUrl, status: "ok" });
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
            onUpdate({ id, url: data.url, status: "ok" });
          } else {
            throw new Error();
          }
        }
      } catch {
        setStatus("error");
        onUpdate({ id, url: null, status: "error" });
      }
    }, waitBeforeStart);

    return () => clearTimeout(timer);
  }, [active, provider, prompt, seed, model, id, waitBeforeStart, slotNumber, onUpdate]);

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
