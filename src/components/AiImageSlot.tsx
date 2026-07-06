"use client";

import { useEffect, useRef, useState } from "react";
import { makePollinationsUrl } from "@/lib/design";

export type AiSlotResult = {
  id: string;
  url: string | null;
  status: "loading" | "ok" | "error";
  error?: string;
};

type Props = {
  id: string;
  slotNumber?: number;
  prompt: string;
  seed: number;
  waitBeforeStart: number;
  active: boolean;
  onUpdate: (slot: AiSlotResult) => void;
  onPick: (url: string) => void;
};

const RETRY_MS = 6000;

export default function AiImageSlot({ id, slotNumber, prompt, seed, waitBeforeStart, active, onUpdate, onPick }: Props) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const retryRef = useRef(0);
  const seedRef = useRef(seed);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeRef = useRef(active);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  activeRef.current = active;

  useEffect(() => {
    if (!active) return;

    retryRef.current = 0;
    seedRef.current = seed;
    setImgSrc(null);
    setReadyUrl(null);
    onUpdateRef.current({ id, url: null, status: "loading" });

    const start = () => {
      if (!activeRef.current) return;
      setImgSrc(`${makePollinationsUrl(prompt, seedRef.current, retryRef.current > 8)}&_=${Date.now()}`);
    };

    timerRef.current = setTimeout(start, waitBeforeStart);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, id, prompt, seed, waitBeforeStart]);

  async function tryServerFallback(): Promise<boolean> {
    try {
      const res = await fetch("/api/designer/generate-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, seed: seedRef.current }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        setReadyUrl(data.url);
        setImgSrc(data.url);
        onUpdateRef.current({ id, url: data.url, status: "ok" });
        return true;
      }
    } catch {
      // keep trying
    }
    return false;
  }

  function scheduleRetry() {
    if (!activeRef.current || readyUrl) return;
    retryRef.current += 1;

    if (retryRef.current % 12 === 0) {
      void tryServerFallback().then((ok) => {
        if (!ok && activeRef.current && !readyUrl) queueRetry();
      });
      return;
    }

    queueRetry();
  }

  function queueRetry() {
    seedRef.current += 7919 + retryRef.current * 211;
    timerRef.current = setTimeout(() => {
      if (!activeRef.current || readyUrl) return;
      setImgSrc(`${makePollinationsUrl(prompt, seedRef.current, retryRef.current > 8)}&_=${Date.now()}`);
    }, RETRY_MS);
  }

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth < 32 || img.naturalHeight < 32) {
      scheduleRetry();
      return;
    }
    const finalUrl = readyUrl ?? makePollinationsUrl(prompt, seedRef.current, retryRef.current > 8);
    setReadyUrl(finalUrl);
    onUpdateRef.current({ id, url: finalUrl, status: "ok" });
  }

  function handleError() {
    scheduleRetry();
  }

  const isOk = !!readyUrl;

  return (
    <div className={`ai-slot ai-slot-${isOk ? "ok" : "loading"}`}>
      {imgSrc && (
        <img
          src={imgSrc}
          alt=""
          onLoad={handleLoad}
          onError={handleError}
          onClick={() => readyUrl && onPick(readyUrl)}
          style={{
            display: isOk ? "block" : "none",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            cursor: isOk ? "pointer" : "default",
          }}
        />
      )}
      {!isOk && (
        <span className="ai-slot-msg">
          {slotNumber ? `Image ${slotNumber}…` : "Generating…"}
        </span>
      )}
    </div>
  );
}
