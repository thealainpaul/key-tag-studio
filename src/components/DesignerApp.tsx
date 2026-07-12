async function generateAi() {
    setAiLoading(true);
    setAiError("");
    const base = Math.floor(Math.random() * 900_000) + 1000;
    const runId = Date.now();
    setAiRunId(runId);
    const seeds = [base, base + 50_000, base + 100_000];
    setAiSeeds(seeds);
    
    setAiResults(
      Array.from({ length: AI_SLOT_COUNT }, (_, i) => ({
        id: `ai-${runId}-${i}`,
        url: null,
        status: "loading" as const,
      }))
    );

    await Promise.all(
      Array.from({ length: AI_SLOT_COUNT }).map(async (_, i) => {
        const cfg = AI_SLOT_CONFIG[i];
        const seed = seeds[i];
        const slotId = `ai-${runId}-${i}`;

        try {
          if (cfg.provider === "pollinations-browser") {
            const url = makePollinationsUrl(aiPrompt, seed, false, cfg.model);
            const finalUrl = `${url}&_=${Date.now()}`;
            setAiResults((prev) => prev.map((s) => (s.id === slotId ? { ...s, url: finalUrl, status: "ok" } : s)));
          } else {
            // Reverted to base URL hit
            const res = await fetch(serverEndpoint(cfg.provider), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: aiPrompt, seed, model: cfg.model, slotNumber: i + 1 }),
            });
            
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const data = await res.json();
            if (data.success) {
              setAiResults((prev) => prev.map((s) => (s.id === slotId ? { ...s, url: data.url, status: "ok" } : s)));
            } else {
              throw new Error("Worker success: false");
            }
          }
        } catch (e) {
          console.error(`Worker ${i + 1} failed:`, e);
          setAiResults((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: "error" } : s)));
        }
      })
    );
    
    setAiLoading(false);
  }
