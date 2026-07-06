/** One provider per slot — avoids hammering a single free API. */
export type AiProvider = "pollinations-browser" | "pollinations-server" | "horde";

export const AI_SLOT_PROVIDERS: AiProvider[] = [
  "pollinations-browser",
  "pollinations-server",
  "horde",
];

export function serverEndpoint(provider: AiProvider): string | null {
  if (provider === "pollinations-server") return "/api/designer/generate-one";
  if (provider === "horde") return "/api/designer/generate-horde";
  return null;
}

export function slotLoadingHint(slotNumber: number, provider: AiProvider): string {
  if (provider === "horde") return `Image ${slotNumber}… (community queue, can take a few min)`;
  return `Image ${slotNumber}…`;
}
