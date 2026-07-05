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
  prompt: string;
  seed: number;
  waitBeforeStart: number;
  active: boolean;
  onUpdate: (slot: AiSlotResult) => void;
  onPick: (url: string) => void;
};

const MAX_RETRIES = 30;
const RETRY_MS = 7000;

export default function AiImageSlot({ id, prompt, seed, waitBeforeStart, active, onUpdate, onPick }: Props) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const retryRef = useRef(0);
  const seedRef = useRef(seed);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!active) return;

    retryRef.current = 0;
    seedRef.current = seed;
    setImgSrc(null);
    setReadyUrl(null);
    onUpdateRef.current({ id, url: null, status: "loading" });

    timerRef.current = setTimeout(() => {
      setImgSrc(`${makePollinationsUrl(prompt, seedRef.current)}&_=${Date.now()}`);
    }, waitBeforeStart);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, id, prompt, seed, waitBeforeStart]);

  async function tryServerFallback() {
    onUpdateRef.current({ id, url: null, status: "loading" });
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
      // fall through
    }
    return false;
  }

  function scheduleRetry() {
    retryRef.current += 1;

    if (retryRef.current > MAX_RETRIES) {
      void (async () => {
        const ok = await tryServerFallback();
        if (!ok) {
          onUpdateRef.current({ id, url: null, status: "error", error: "Could not generate this option" });
        }
      })();
      return;
    }

    seedRef.current += 7919 + retryRef.current * 211;
    const simple = retryRef.current > 6;
    timerRef.current = setTimeout(() => {
      setReadyUrl(null);
      setImgSrc(`${makePollinationsUrl(prompt, seedRef.current, simple)}&_=${Date.now()}`);
    }, RETRY_MS);
  }

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth < 32 || img.naturalHeight < 32) {
      scheduleRetry();
      return;
    }
    const finalUrl = readyUrl ?? makePollinationsUrl(prompt, seedRef.current, retryRef.current > 6);
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
      {!isOk && <span className="ai-slot-msg">Generating…</span>}
    </div>
  );
}
