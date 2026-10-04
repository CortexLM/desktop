import { attachmentFilename, readInlineBytes } from "./bytes";

export type Raster = { bytes: Uint8Array<ArrayBuffer>; mime: "image/png" | "image/jpeg" | "image/webp"; width: number; height: number };
type Reason = "unsupported" | "invalid" | "tooLarge";
type Size = Pick<Raster, "width" | "height">;
const check = (ok: boolean, reason: Reason = "invalid") => { if (!ok) throw reason; };
const tag = (b: Uint8Array, p: number) => String.fromCharCode(...b.subarray(p, p + 4));
const u24 = (b: Uint8Array, p: number) => b[p] + b[p + 1] * 256 + b[p + 2] * 65536;
function size(width: number, height: number): Size {
  check(width > 0 && height > 0);
  check(width <= 32_768 && height <= 32_768 && width * height <= 40_000_000, "tooLarge");
  return { width, height };
}

function png(b: Uint8Array): Size {
  check(b.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v));
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let dimensions: Size | undefined, color = -1, depth = 0, palette = false, data = 0, seenData = false, endedData = false;
  for (let p = 8; p < b.length;) {
    check(p + 12 <= b.length);
    const n = v.getUint32(p), type = tag(b, p + 4), start = p + 8, end = start + n;
    check(n <= b.length - p - 12 && /^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type));
    check(!["acTL", "fcTL", "fdAT"].includes(type), "unsupported");
    if (type === "IHDR") {
      check(p === 8 && n === 13 && !dimensions);
      dimensions = size(v.getUint32(start), v.getUint32(start + 4));
      depth = b[start + 8]; color = b[start + 9];
      const depths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      check(!!depths[color]?.includes(depth) && b[start + 10] === 0 && b[start + 11] === 0 && b[start + 12] <= 1);
    } else {
      check(!!dimensions);
      if (type === "PLTE") {
        check(!palette && !seenData && color !== 0 && color !== 4 && n > 0 && n <= 768 && n % 3 === 0 && (color !== 3 || n / 3 <= 2 ** depth));
        palette = true;
      } else if (type === "IDAT") {
        check(!endedData && (color !== 3 || palette)); seenData = true; data += n;
      } else if (type === "IEND") {
        check(n === 0 && data > 0 && end + 4 === b.length);
        return dimensions!;
      } else check(type[0] === type[0].toLowerCase(), "unsupported");
      if (seenData && type !== "IDAT") endedData = true;
    }
    p = end + 4;
  }
  throw "invalid";
}

function jpeg(b: Uint8Array): Size {
  check(b[0] === 0xff && b[1] === 0xd8);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let dimensions: Size | undefined, components = 0, entropy = false, scanned = false;
  for (let p = 2; p < b.length;) {
    // Scan framing only: stuffed FF00/restart markers are entropy, not new headers.
    if (entropy) while (p < b.length && b[p] !== 0xff) p++;
    check(b[p++] === 0xff);
    while (b[p] === 0xff) p++;
    check(p < b.length);
    const marker = b[p++];
    if (entropy && (marker === 0 || marker >= 0xd0 && marker <= 0xd7)) continue;
    entropy = false;
    if (marker === 0xd9) { check(!!dimensions && scanned && p === b.length); return dimensions!; }
    check(marker !== 0 && marker !== 0xd8 && !(marker >= 0xd0 && marker <= 0xd7));
    check(marker >= 0xe0 && marker <= 0xef || [0xc0, 0xc1, 0xc2, 0xc4, 0xda, 0xdb, 0xdd, 0xfe].includes(marker), "unsupported");
    check(p + 2 <= b.length);
    const n = v.getUint16(p);
    check(n >= 2 && n <= b.length - p);
    if (marker >= 0xc0 && marker <= 0xc2) {
      check(!dimensions && n >= 8);
      check(b[p + 2] === 8, "unsupported");
      components = b[p + 7]; check([1, 3, 4].includes(components) && n === 8 + 3 * components);
      dimensions = size(v.getUint16(p + 5), v.getUint16(p + 3));
    } else if (marker === 0xda) {
      check(!!dimensions && n >= 6 && b[p + 2] > 0 && b[p + 2] <= components && n === 6 + 2 * b[p + 2]);
      scanned = entropy = true;
    } else if (marker === 0xdd) check(n === 4);
    p += n;
  }
  throw "invalid";
}

function webp(b: Uint8Array): Size {
  check(b.length >= 20 && tag(b, 0) === "RIFF" && tag(b, 8) === "WEBP");
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  check(v.getUint32(4, true) + 8 === b.length);
  let canvas: Size | undefined, image: Size | undefined, flags = 0, alpha = false, kind = "";
  const metadata = new Set<string>();
  for (let p = 12; p < b.length;) {
    check(p + 8 <= b.length);
    const type = tag(b, p), n = v.getUint32(p + 4, true), start = p + 8, end = start + n;
    check(n <= b.length - start && end + n % 2 <= b.length && (!(n % 2) || b[end] === 0));
    check(type !== "ANIM" && type !== "ANMF", "unsupported");
    if (type === "VP8X") {
      check(p === 12 && n === 10 && !canvas);
      flags = b[start]; check(!(flags & 0xc1) && b[start + 1] === 0 && b[start + 2] === 0 && b[start + 3] === 0);
      check(!(flags & 2), "unsupported");
      canvas = size(u24(b, start + 4) + 1, u24(b, start + 7) + 1);
    } else if (type === "VP8 ") {
      check(!image && n >= 10 && !(b[start] & 1) && ((b[start] >> 1) & 7) <= 3 && !!(b[start] & 16));
      check(b[start + 3] === 0x9d && b[start + 4] === 1 && b[start + 5] === 0x2a);
      const width = v.getUint16(start + 6, true), height = v.getUint16(start + 8, true);
      check(!(width & 0xc000) && !(height & 0xc000)); image = size(width, height); kind = type;
    } else if (type === "VP8L") {
      check(!image && !alpha && n >= 5 && b[start] === 0x2f && !(b[start + 4] & 0xe0));
      const bits = v.getUint32(start + 1, true);
      image = size((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1); kind = type;
    } else if (type === "ALPH") {
      check(!!canvas && !!(flags & 16) && !alpha && !image && n > 0); alpha = true;
    } else if (["ICCP", "EXIF", "XMP "].includes(type)) {
      check(!!canvas && !metadata.has(type) && !!(flags & ({ ICCP: 32, EXIF: 8, "XMP ": 4 }[type]!)));
      metadata.add(type);
    }
    p = end + n % 2;
  }
  check(!!image && (!canvas || canvas.width === image!.width && canvas.height === image!.height));
  check(!canvas || kind !== "VP8 " || alpha === !!(flags & 16));
  for (const [type, flag] of [["ICCP", 32], ["EXIF", 8], ["XMP ", 4]] as const) check(!!(flags & flag) === metadata.has(type));
  return image!;
}

/** ponytail: structural/dimension preflight only; the caller must finish native decoding before display.
 * CRCs and compressed pixel integrity are not verified here. Limits do not bound total decoder/IPC memory. */
export function readRaster(input: { mime: string; data?: string; url?: string }): { ok: true; value: Raster } | { ok: false; reason: Reason } {
  try {
    check(!!input && typeof input.mime === "string");
    const mime = input.mime.toLowerCase() as Raster["mime"];
    check(["image/png", "image/jpeg", "image/webp"].includes(mime), "unsupported");
    // Preserve unsupported-header versus supported-MIME-mismatch reasons from raster preflight.
    if (input.data === undefined && typeof input.url === "string") check(/^data:image\/(?:png|jpeg|webp);base64,/i.test(input.url), "unsupported");
    const bytes = readInlineBytes(input, mime, 50_000_000);
    const dimensions = mime === "image/png" ? png(bytes) : mime === "image/jpeg" ? jpeg(bytes) : webp(bytes);
    return { ok: true, value: { bytes, mime, ...dimensions } };
  } catch (reason) { return { ok: false, reason: reason === "unsupported" || reason === "tooLarge" ? reason : "invalid" }; }
}

export function rasterFilename(name: string | undefined, mime: Raster["mime"]): string {
  return attachmentFilename(name, mime === "image/jpeg" ? "jpg" : mime.slice(6), "image");
}
