// Minimal zip reader for local files picked in the live viewers: central directory listing plus stored/deflate entries.
export type ZipEntry = { name: string; size: number; method: number; offset: number; csize: number };

export function listZip(buf: ArrayBuffer): ZipEntry[] {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip");
  const count = v.getUint16(eocd + 10, true), out: ZipEntry[] = [];
  let p = v.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("bad central directory");
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), size = v.getUint32(p + 24, true);
    const nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), offset = v.getUint32(p + 42, true);
    out.push({ name: new TextDecoder().decode(new Uint8Array(buf, p + 46, nl)), size, method, offset, csize });
    p += 46 + nl + el + cl;
  }
  return out;
}

export async function readZipText(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  const v = new DataView(buf), start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
  const raw = new Uint8Array(buf, start, e.csize);
  if (e.method === 0) return new TextDecoder().decode(raw);
  if (e.method !== 8) throw new Error("unsupported method");
  return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
}

/** Visible text of an Office XML part: paragraphs (w:p / a:p) become lines. */
export const xmlText = (xml: string) => xml.replace(/<\/(?:w|a):p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/\n{2,}/g, "\n").trim();
