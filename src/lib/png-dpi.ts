/** Embed PNG pHYs chunk so print software reads the correct DPI. */
export function embedPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (png.length < 33 || png[0] !== 0x89) return png;

  const ppm = Math.round(dpi / 0.0254);
  const physData = new Uint8Array(9);
  const view = new DataView(physData.buffer);
  view.setUint32(0, ppm, false);
  view.setUint32(4, ppm, false);
  physData[8] = 1;

  const physChunk = makePngChunk("pHYs", physData);

  let pos = 8;
  const ihdrLen = readU32(png, pos);
  const afterIhdr = pos + 12 + ihdrLen;
  const tail = stripPhysChunks(png.slice(afterIhdr));

  const out = new Uint8Array(afterIhdr + physChunk.length + tail.length);
  out.set(png.slice(0, afterIhdr), 0);
  out.set(physChunk, afterIhdr);
  out.set(tail, afterIhdr + physChunk.length);
  return out;
}

function stripPhysChunks(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let pos = 0;
  while (pos + 12 <= bytes.length) {
    const len = readU32(bytes, pos);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const end = pos + 12 + len;
    if (end > bytes.length) break;
    if (type !== "pHYs") parts.push(bytes.slice(pos, end));
    if (type === "IEND") break;
    pos = end;
  }
  if (parts.length === 0) return bytes;
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeU32(chunk, 0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  writeU32(chunk, 8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

function readU32(buf: Uint8Array, off: number): number {
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

function writeU32(buf: Uint8Array, off: number, value: number) {
  buf[off] = (value >>> 24) & 0xff;
  buf[off + 1] = (value >>> 16) & 0xff;
  buf[off + 2] = (value >>> 8) & 0xff;
  buf[off + 3] = value & 0xff;
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
