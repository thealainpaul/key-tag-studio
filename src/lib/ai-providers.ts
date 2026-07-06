/** One path per slot — browser IP, server IP, then browser again once slot 1 is done. */
export type AiProvider = "pollinations-browser" | "pollinations-server";

export type AiSlotConfig = {
  provider: AiProvider;
  model: string;
  /** Wait for this slot index (0-based) to succeed before starting. */
  startsAfterSlot?: number;
};

export const AI_SLOT_CONFIG: AiSlotConfig[] = [
  { provider: "pollinations-browser", model: "turbo" },
  { provider: "pollinations-server", model: "turbo" },
  { provider: "pollinations-browser", model: "flux", startsAfterSlot: 0 },
];

export function serverEndpoint(provider: AiProvider): string | null {
  if (provider === "pollinations-server") return "/api/designer/generate-one";
  return null;
}

export function slotLoadingHint(slotNumber: number, waitingForFirst: boolean): string {
  if (waitingForFirst) return `Image ${slotNumber}… (starts when image 1 is ready)`;
  return `Image ${slotNumber}…`;
}
