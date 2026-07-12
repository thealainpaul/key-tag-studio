export type AiProvider = "pollinations-browser" | "pollinations-server";

export type AiSlotConfig = {
  provider: AiProvider;
  model: string;
};

export const AI_SLOT_CONFIG: AiSlotConfig[] = [
  { provider: "pollinations-browser", model: "turbo" },
  { provider: "pollinations-browser", model: "turbo" },
  { provider: "pollinations-server", model: "turbo" },
];

export function serverEndpoint(provider: AiProvider): string | null {
  if (provider === "pollinations-server") return "/api/designer/generate-one";
  return null;
}

export function slotLoadingHint(slotNumber: number): string {
  return `Slot ${slotNumber} initializing...`;
}
