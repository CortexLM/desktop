import { describe, expect, it, vi } from "vitest";
import { rasterFilename, readRaster, type Raster } from "./raster";

// Independently encoded 3×2 images (Pillow/libjpeg/libwebp); no DOM or codec is used by these tests.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAFUlEQVR4nGOUr7/MwMDAwMDAxAADABl6AXVIlSfwAAAAAElFTkSuQmCC";
const RGBA = "iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAE0lEQVR4nGOUr79czwAFTAxIAAAtHAH0bv0CRQAAAABJRU5ErkJggg==";
const PALETTE = "iVBORw0KGgoAAAANSUhEUgAAAAMAAAACAQMAAACnuvRZAAAABlBMVEUff9MAAAAYhGjoAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC";
const JPEG = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAMDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJYBoHP/2Q==";
const PROGRESSIVE = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wgARCAACAAMDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUAQEAAAAAAAAAAAAAAAAAAAAF/9oADAMBAAIQAxAAAAGUNDf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAn//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AX//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AX//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/An//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==";
const WEBP = "UklGRjoAAABXRUJQVlA4IC4AAAAQAgCdASoDAAIAAUAmJaACdLoB+AH4AAPIAP7q1H/9QW+TPPnt//TRRhTH20AA";
const LOSSLESS = "UklGRh4AAABXRUJQVlA4TBEAAAAvAkAAAAfQv350uv+BiOh/AAA=";
const EXTENDED = "UklGRlwAAABXRUJQVlA4WAoAAAAIAAAAAgAAAQAAVlA4IC4AAAAQAgCdASoDAAIAAUAmJaACdLoB+AH4AAPIAP7q1H/9QW+TPPnt//TRRhTH20AARVhJRgcAAABmaXh0dXJlAA==";
const ALPHA = "UklGRlwAAABXRUJQVlA4WAoAAAAQAAAAAgAAAQAAQUxQSAcAAAAAf39/f39/AFZQOCAuAAAAEAIAnQEqAwACAAFAJiWgAnS6AfgB+AADyAD+6tR//UFvkzz57f/00UYUx9tAAA==";
const LOSSLESS_ALPHA = "UklGRkAAAABXRUJQVlA4WAoAAAAYAAAAAgAAAQAAVlA4TBEAAAAvAkAAEAfQv350un+BiOh/AABFWElGBwAAAGZpeHR1cmUA";
const APNG = "iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAADAAAAAgAAAAAAAAAAAAEACgAAP7ZcWAAAABNJREFUeJxjlK+/XM8ABUwMSAAALRwB9G79AkUAAAAaZmNUTAAAAAEAAAADAAAAAgAAAAAAAAAAAAEACgAApMW2jAAAABdmZEFUAAAAAnicY7xcL1/PAAVMDEgAAC6EAfRdRYCQAAAAAElFTkSuQmCC";
const ANIMATED_WEBP = "UklGRugAAABXRUJQVlA4WAoAAAASAAAAAgAAAQAAQU5JTQYAAAAAAAAAAABBTk1GWgAAAAAAAAAAAAIAAAEAAGQAAAJBTFBIBwAAAAB/f39/f38AVlA4IDIAAAAwAQCdASoDAAIAAUAmJaAAA3AA/urUf//1Bn/+rQ//5aH7Cn//00j/+mkf/00j5TQAAEFOTUZaAAAAAAAAAAAAAgAAAQAAZAAAAkFMUEgHAAAAAH9/f39/fwBWUDggMgAAADABAJ0BKgMAAgABQCYloAADcAD+21H//9ej//z0f/+ej/P9//+emf/4JP/+CT8ZAAAA";
const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const encode = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const join = (...arrays: Uint8Array[]) => Uint8Array.from(arrays.flatMap((a) => [...a]));
const input = (b: Uint8Array, mime: Raster["mime"] = "image/png") => ({ mime, data: encode(b) });
const alter = (s: string, change: (b: Uint8Array, v: DataView) => void) => { const b = bytes(s); change(b, new DataView(b.buffer)); return b; };
const fail = (b: Uint8Array, mime: Raster["mime"] = "image/png", reason = "invalid") => expect(readRaster(input(b, mime))).toEqual({ ok: false, reason });
// Structural probes deliberately leave codec payloads/PNGs' CRCs untouched; only native decode verifies those.
const chunk = (type: string, data = new Uint8Array(), little = false) => {
  const b = new Uint8Array(8 + data.length + (little ? data.length % 2 : 4)), v = new DataView(b.buffer);
  b.set([...type].map((c) => c.charCodeAt(0)), little ? 0 : 4); v.setUint32(little ? 4 : 0, data.length, little); b.set(data, 8); return b;
};
const riff = (...chunks: Uint8Array[]) => {
  const b = join(bytes(WEBP).slice(0, 12), ...chunks); new DataView(b.buffer).setUint32(4, b.length - 8, true); return b;
};

describe("saved raster preflight", () => {
  it.each([
    ["RGB PNG", "image/png", PNG], ["RGBA PNG", "image/png", RGBA], ["indexed PNG", "image/png", PALETTE],
    ["baseline JPEG", "image/jpeg", JPEG], ["progressive JPEG", "image/jpeg", PROGRESSIVE],
    ["lossy WebP", "image/webp", WEBP], ["lossless WebP", "image/webp", LOSSLESS], ["extended WebP", "image/webp", EXTENDED],
    ["alpha WebP", "image/webp", ALPHA], ["extended lossless alpha WebP", "image/webp", LOSSLESS_ALPHA],
  ])("preserves original bytes of %s through both supported sources", (_, mime, data) => {
    for (const source of [{ data }, { url: `data:${mime.toUpperCase()};base64,${data}` }, { data: data.replace(/=+$/, "") }]) {
      const result = readRaster({ mime: mime.toUpperCase(), ...source });
      expect(result.ok).toBe(true);
      if (result.ok) { expect(result.value).toMatchObject({ mime, width: 3, height: 2 }); expect(result.value.bytes).toEqual(bytes(data)); }
    }
  });

  it("refuses ambiguous sources, unsafe URLs, MIME mismatches and non-raster bytes", () => {
    for (const source of [{}, { data: PNG, url: `data:image/png;base64,${PNG}` }, { data: "", url: `data:image/png;base64,${PNG}` },
      ...["https://example.test/a.png", "file:///a.png", "/img/a.png", "blob:cortex://app/foreign", `data:image/png;charset=utf-8;base64,${PNG}`, `data:image/png,${PNG}`].map((url) => ({ url }))]) {
      expect(readRaster({ mime: "image/png", ...source })).toEqual({ ok: false, reason: "unsupported" });
    }
    for (const mime of ["image/svg+xml", "text/html", "image/gif", "image/png; charset=utf-8", " image/png", "image/png\n", "image/webp\n"]) expect(readRaster({ mime, data: PNG })).toEqual({ ok: false, reason: "unsupported" });
    expect(readRaster({ mime: "image/png", url: `data:image/jpeg;base64,${PNG}` })).toEqual({ ok: false, reason: "invalid" });
    for (const s of ["<svg xmlns='http://www.w3.org/2000/svg'/>", "<html>no</html>"]) fail(new TextEncoder().encode(s));
    fail(bytes(PNG), "image/jpeg"); fail(bytes(JPEG), "image/webp"); fail(bytes(WEBP));
    expect(readRaster({ mime: "image/png", data: 1 } as unknown as Parameters<typeof readRaster>[0])).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects noncanonical base64 before atob, including ignored whitespace and pad bits", () => {
    const decode = vi.spyOn(globalThis, "atob");
    try {
      for (const data of ["", "A", "A===", "AA=", "AA===", "=AAA", "AA=A", `${PNG}\n`, ` ${PNG}`, PNG.replace("/", "_"), `%${PNG}`, RGBA.replace(/gg==$/, "gh=="), RGBA.replace(/gg==$/, "gh"), LOSSLESS.replace(/A=$/, "B="), LOSSLESS.replace(/A=$/, "B"), `data:image/png;base64,${PNG}`]) {
        expect(readRaster({ mime: "image/png", data })).toEqual({ ok: false, reason: "invalid" });
      }
      expect(decode).not.toHaveBeenCalled();
    } finally { decode.mockRestore(); }
  });

  it("refuses byte excess before expansion while admitting the exact byte ceiling", () => {
    const decode = vi.spyOn(globalThis, "atob").mockImplementation(() => { throw new Error("Stop before a 50 MB allocation"); }), oversized = "A".repeat(66_666_668);
    try {
      expect(readRaster({ mime: "image/png", data: oversized })).toEqual({ ok: false, reason: "tooLarge" });
      expect(readRaster({ mime: "image/png", data: `${oversized}AAAA` })).toEqual({ ok: false, reason: "tooLarge" });
      expect(decode).not.toHaveBeenCalled();
      expect(readRaster({ mime: "image/png", data: `${oversized.slice(0, -1)}=` })).toEqual({ ok: false, reason: "invalid" });
      expect(decode).toHaveBeenCalledTimes(1);
    } finally { decode.mockRestore(); }
  });

  it("enforces inclusive pixel/dimension bounds before any native decoder exists", () => {
    expect(typeof document).toBe("undefined"); expect(typeof createImageBitmap).toBe("undefined");
    for (const [width, height, reason] of [[8000, 5000, null], [32_768, 1, null], [1, 32_768, null], [8001, 5000, "tooLarge"], [32_769, 1, "tooLarge"], [0, 1, "invalid"]] as const) {
      const b = alter(PNG, (_, v) => { v.setUint32(16, width); v.setUint32(20, height); }), result = readRaster(input(b));
      if (reason) expect(result).toEqual({ ok: false, reason }); else expect(result).toMatchObject({ ok: true, value: { width, height } });
    }
    fail(alter(JPEG, (_, v) => v.setUint16(163, 32_769)), "image/jpeg", "tooLarge");
    fail(alter(EXTENDED, (b) => { b[24] = 0; b[25] = 128; }), "image/webp", "tooLarge");
    fail(alter(LOSSLESS, (_, v) => v.setUint32(21, 7999 | (5000 << 14), true)), "image/webp", "tooLarge");
  });

  it("rejects PNG truncation, duplicate/conflicting headers, invalid ordering and APNG", () => {
    const b = bytes(PNG), idat = b.slice(33, -12);
    for (const bad of [b.slice(0, -1), join(b, Uint8Array.of(0)), alter(PNG, (_, v) => v.setUint32(33, 0xffffffff)),
      join(b.slice(0, 33), b.slice(8, 33), b.slice(33)), join(b.slice(0, 8), idat, b.slice(8, 33), b.slice(-12)),
      join(b.slice(0, 33), b.slice(-12)), join(b.slice(0, -12), chunk("tEXt"), idat, b.slice(-12)),
      alter(PNG, (b) => { b[24] = 3; }), alter(PNG, (b) => { b[28] = 2; })]) fail(bad);
    fail(bytes(APNG), "image/png", "unsupported");
    fail(join(b.slice(0, 33), chunk("fcTL"), b.slice(33)), "image/png", "unsupported");
    fail(join(b.slice(0, 33), chunk("ABCD"), b.slice(33)), "image/png", "unsupported");
    // Chunk-like text is not animation; arbitrary ancillary metadata stays byte-identical.
    expect(readRaster(input(join(b.slice(0, 33), chunk("tEXt", new TextEncoder().encode("note\0acTL ANMF")), b.slice(33))))).toMatchObject({ ok: true });
    const palette = bytes(PALETTE); fail(join(palette.slice(0, 33), palette.slice(51))); // Required PLTE removed.
  });

  it("walks JPEG segment/scan framing without treating stuffed entropy or metadata as SOF", () => {
    const b = bytes(JPEG), sof = b.slice(158, 177);
    for (const bad of [b.slice(0, -2), join(b, Uint8Array.of(0)), alter(JPEG, (_, v) => v.setUint16(4, 1)),
      alter(JPEG, (_, v) => v.setUint16(4, 65535)), join(b.slice(0, 177), sof, b.slice(177)),
      join(b.slice(0, -2), sof, b.slice(-2)), alter(JPEG, (b) => { b[167] = 2; })]) fail(bad, "image/jpeg");
    const comment = join(Uint8Array.of(0xff, 0xfe, 0, 6), Uint8Array.of(0xff, 0xc0, 0xff, 0xd9));
    const framed = join(b.slice(0, 2), comment, b.slice(2, -2), Uint8Array.of(0xff, 0, 0xc0, 0xff, 0xd0, 4), b.slice(-2));
    expect(readRaster(input(framed, "image/jpeg"))).toMatchObject({ ok: true, value: { width: 3, height: 2 } });
  });

  it("checks WebP RIFF/chunk bounds, one bitstream and matching canvas dimensions", () => {
    const b = bytes(WEBP), extended = bytes(EXTENDED);
    for (const bad of [b.slice(0, -1), join(b, Uint8Array.of(0)), alter(WEBP, (_, v) => v.setUint32(16, 0xffffffff, true)),
      riff(b.slice(12), b.slice(12)), riff(extended.slice(12, 30), extended.slice(12, 30), b.slice(12)),
      alter(EXTENDED, (b) => { b[24] = 3; }), alter(WEBP, (b) => { b[23] = 0; }),
      alter(LOSSLESS, (b) => { b[37] = 1; }), alter(LOSSLESS, (b) => { b[24] |= 0xe0; }),
      alter(EXTENDED, (b) => { b[20] |= 1; }), riff(extended.slice(12, 30))]) fail(bad, "image/webp");
    expect(readRaster(input(riff(b.slice(12), chunk("JUNK", new TextEncoder().encode("ANIM"), true)), "image/webp"))).toMatchObject({ ok: true });
    fail(bytes(ANIMATED_WEBP), "image/webp", "unsupported");
    fail(riff(b.slice(12), chunk("ANMF", new Uint8Array(), true)), "image/webp", "unsupported");
  });

  it("returns safe bounded download basenames without changing the validated extension", () => {
    for (const [name, want] of [[undefined, "image.png"], ["", "image.png"], ["../../photo.exe", "photo.png"], ["C:\\temp\\image.JPG", "image.png"],
      ["bad\u0000\n\u202egnp.exe", "badgnp.png"], ["NUL.jpg", "image.png"], ["LPT¹.a.jpg", "image.png"], ["...", "image.png"], ["<a>|?:.html", "a.png"]]) expect(rasterFilename(name, "image/png")).toBe(want);
    expect(rasterFilename("雪🙂".repeat(100), "image/jpeg")).toBe(`${"雪🙂".repeat(30)}.jpg`);
    expect(new TextEncoder().encode(rasterFilename("🙂".repeat(100), "image/webp")).length).toBeLessThanOrEqual(255);
    expect(rasterFilename("photo.tar.gz", "image/webp")).toBe("photo.tar.webp");
    expect(rasterFilename(`a${" ".repeat(200_000)}b.png`, "image/png")).toBe("a.png");
  });
});
