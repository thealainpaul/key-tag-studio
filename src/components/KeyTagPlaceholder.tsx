import { CANVAS_H, CANVAS_W, keyTagBorderWidth, keyTagSvgPath } from "@/lib/keytag-shape";

/** Shows the key tag instantly in HTML before JavaScript paints the canvas. */
export default function KeyTagPlaceholder() {
  const d = keyTagSvgPath();
  const stroke = keyTagBorderWidth();
  return (
    <svg
      className="preview-placeholder"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <path d={d} fill="#1f1f1f" />
      <path d={d} fill="none" stroke="#ef4444" strokeWidth={stroke} />
    </svg>
  );
}
