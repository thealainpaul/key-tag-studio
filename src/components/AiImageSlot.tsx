"use client";

import { useEffect, useRef } from "react";
import { type AiProvider, serverEndpoint, slotLoadingHint } from "@/lib/ai-providers";
import { useState } from "react";

export type AiSlotResult = {
  id: string;
  url: string | null;
  status: "loading" | "ok" | "error";
  error?: string;
};

type Props = {
  id: string;
  slotNumber?: number;
  provider: AiProvider;
  model: string;
  prompt: string;
  seed: number;
  active: boolean;
  onUpdate: (slot: AiSlotResult) => void;
  onPick: (url: string) => void;
};

export default function AiImageSlot({
  id,
  slotNumber,
  provider,
  model,
  prompt,
  seed,
  active,
  onUpdate,
  onPick,
}: Props) {
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!active) return;
    
    async function generate() {
      onUpdate({ id, url: null, status: "loading" });
      setStatus("loading");

      try {
        const res = await fetch(serverEndpoint(provider)!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, seed, model, slotNumber }), // slotNumber is sent here!
        });
        
        const data = await res.json();
        if (data.success) {
          setReadyUrl(data.url);
          setStatus("ok");
          onUpdate({ id, url: data.url, status: "ok" });
        } else {
          throw new Error();
        }
      } catch {
        setStatus("error");
        onUpdate({ id, url: null, status: "error" });
      }
    }

    generate();
  }, [active, id, prompt, seed, provider, model, slotNumber, onUpdate]);

  const isOk = status === "ok";
  const loadingMsg = slotNumber ? slotLoadingHint(slotNumber) : "Generating…";

  return (
    <div className={`ai-slot ai-slot-${status}`}>
      {isOk && readyUrl ? (
        <img
          src={readyUrl}
          alt=""
          onClick={() => onPick(readyUrl)}
          style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
        />
      ) : (
        <span className="ai-slot-msg">{loadingMsg}</span>
      )}
    </div>
  );
}
