"use client";

import { type AiProvider, slotLoadingHint } from "@/lib/ai-providers";

export type AiSlotResult = {
  id: string;
  url: string | null;
  status: "loading" | "ok" | "error";
};

type Props = {
  slotNumber: number;
  provider: AiProvider;
  status: "loading" | "ok" | "error";
  url: string | null;
  onPick: (url: string) => void;
};

export default function AiImageSlot({ slotNumber, status, url, onPick }: Props) {
  return (
    <div className={`ai-slot ai-slot-${status}`}>
      {url ? (
        <img
          src={url}
          onClick={() => onPick(url)}
          style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
        />
      ) : (
        <span className="ai-slot-msg">{slotLoadingHint(slotNumber)}</span>
      )}
    </div>
  );
}
