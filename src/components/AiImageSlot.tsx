"use client";

import { useEffect, useRef, useState } from "react";
import { makePollinationsUrl } from "@/lib/design";
import { type AiProvider, serverEndpoint, slotLoadingHint } from "@/lib/ai-providers";

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
  prompt: string;
  seed: number;
  waitBeforeStart: number;
  active: boolean;
  onUpdate: (slot: AiSlotResult) => void;
  onPick: (url: string) => void;
};

const RETRY_MS = 3500;
const SERVER_FALLBACK_EVERY = 5;
const MAX_SERVER_RETRIES = 6;

export default function AiImageSlot({
  id,
  slotNumber,
  provider,
  prompt,
  seed,
  waitBeforeStart,
  active,
  onUpdate,
  onPick,
}: Props) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const retryRef = useRef(0);
  const seedRef = useRef(seed);
  const readyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeRef = useRef(active);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  activeRef.current = active;

  useEffect(() => {
    if (!active) return;

    retryRef.current = 0;
    seedRef.current = seed;
    readyRef.current = false;
    setImgSrc(null);
    setReadyUrl(null);
    onUpdateRef.current({ id, url: null, status: "loading" });

    const endpoint = serverEndpoint(provider);

    async function runServer() {
      if (!endpoint || !activeRef.current) return;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, seed: seedRef.current }),
        });
        const data = await res.json();
        if (data.success && data.url) {
          readyRef.current = true;
          setReadyUrl(data.url);
          setImgSrc(data.url);
          onUpdateRef.current({ id, url: data.url, status: "ok" });
          return;
        }
      } catch {
        // retry below
      }
      if (!activeRef.current || readyRef.current) return;
      retryRef.current += 1;
      if (retryRef.current >= MAX_SERVER_RETRIES) {
        onUpdateRef.current({ id, url: null, status: "error", error: "Could not generate" });
        return;
      }
      timerRef.current = setTimeout(() => void runServer(), RETRY_MS * retryRef.current);
    }

    const start = () => {
      if (!activeRef.current) return;
      if (provider === "pollinations-browser") {
        setImgSrc(`${makePollinationsUrl(prompt, seedRef.current, retryRef.current > 8)}&_=${Date.now()}`);
      } else {
        void runServer();
      }
    };

    timerRef.current = setTimeout(start, waitBeforeStart);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, id, prompt, seed, waitBeforeStart, provider]);

  async function tryServerFallback(): Promise<boolean> {
    try {
      const res = await fetch("/api/designer/generate-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, seed: seedRef.current }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        readyRef.current = true;
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
    if (!activeRef.current || readyRef.current) return;
    retryRef.current += 1;

    if (retryRef.current % SERVER_FALLBACK_EVERY === 0) {
      void tryServerFallback().then((ok) => {
        if (!ok && activeRef.current && !readyRef.current) queueRetry();
      });
      return;
    }

    queueRetry();
  }

  function queueRetry() {
    seedRef.current += 7919 + retryRef.current * 211;
    timerRef.current = setTimeout(() => {
      if (!activeRef.current || readyRef.current) return;
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
    readyRef.current = true;
    setReadyUrl(finalUrl);
    onUpdateRef.current({ id, url: finalUrl, status: "ok" });
  }

  function handleError() {
    scheduleRetry();
  }

  const isOk = !!readyUrl;
  const loadingMsg =
    slotNumber && provider ? slotLoadingHint(slotNumber, provider) : "Generating…";

  return (
    <div className={`ai-slot ai-slot-${isOk ? "ok" : "loading"}`}>
      {imgSrc && (
        <img
          src={imgSrc}
          alt=""
          onLoad={provider === "pollinations-browser" ? handleLoad : undefined}
          onError={provider === "pollinations-browser" ? handleError : undefined}
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
      {!isOk && <span className="ai-slot-msg">{loadingMsg}</span>}
    </div>
  );
}
