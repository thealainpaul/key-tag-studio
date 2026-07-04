export type TextLine = {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  x: number;
  y: number;
  linkedImageId: string | null;
};

export type DesignImage = {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type DesignPayload = {
  tagColor: string;
  images: DesignImage[];
  textLines: TextLine[];
  backgroundImageId: string | null;
};

export function pollinationsUrl(prompt: string, seed: number, width = 1086, height = 845) {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
}
