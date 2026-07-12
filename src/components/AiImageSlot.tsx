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
  onUpdate: (slot: any) => void;
  onPick: (url: string) => void;
};

export default function AiImageSlot({ id, slotNumber, provider, model, prompt, seed, active, onUpdate, onPick }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!active) return;
    setStatus("loading");
    setImgUrl(null);

    async function load() {
      try {
        if (provider === "pollinations-browser") {
          const url = makePollinationsUrl(prompt, seed, false, model);
          setImgUrl(`${url}&_=${Date.now()}`);
          setStatus("ok");
        } else {
          const res = await fetch(serverEndpoint(provider)!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, seed, model }),
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
    }
    load();
  }, [active, provider, prompt, seed, model, id]);

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
