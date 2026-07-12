export type AiProvider = "pollinations-server-a" | "pollinations-server-b" | "pollinations-server-c" | "pollinations-browser";

export type AiSlotConfig = {
  provider: AiProvider;
  model: string;
};

export const AI_SLOT_CONFIG: AiSlotConfig[] = [
  { provider: "pollinations-server-a", model: "turbo" },
  { provider: "pollinations-server-b", model: "turbo" },
  { provider: "pollinations-server-c", model: "turbo" },
];

export function serverEndpoint(provider: AiProvider): string {
  const endpoints: Record<AiProvider, string> = {
    "pollinations-server-a": process.env.NEXT_PUBLIC_API_A || "https://key-tag-worker-a.onrender.com",
    "pollinations-server-b": process.env.NEXT_PUBLIC_API_B || "https://key-tag-worker-b.onrender.com",
    "pollinations-server-c": process.env.NEXT_PUBLIC_API_C || "https://key-tag-worker-c.onrender.com",
    "pollinations-browser": "",
  };
  return endpoints[provider];
}

export function slotLoadingHint(slotNumber: number): string {
  return `Slot ${slotNumber} initializing on worker...`;
}
