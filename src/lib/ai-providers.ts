export type AiProvider = "pollinations-server-a" | "pollinations-server-b" | "pollinations-server-c";

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
    "pollinations-server-a": process.env.NEXT_PUBLIC_API_A || "/api/designer/generate-one",
    "pollinations-server-b": process.env.NEXT_PUBLIC_API_B || "/api/designer/generate-one",
    "pollinations-server-c": process.env.NEXT_PUBLIC_API_C || "/api/designer/generate-one",
  };
  return endpoints[provider];
}

export function slotLoadingHint(slotNumber: number): string {
  return `Slot ${slotNumber} initializing on worker...`;
}
