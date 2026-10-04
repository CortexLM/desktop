import { describe, expect, it, vi } from "vitest";
import { readInlineBytes } from "./bytes";
import { readRaster } from "./raster";
import { isTextMime, readText, textFilename } from "./text-data";

const input = (text: string, mime = "text/plain") => ({ mime, data: Buffer.from(text, "utf8").toString("base64") });

describe("saved text preflight", () => {
  it("accepts explicit empty and BOM-only sources while keeping raster nonempty", () => {
    for (const text of ["", "\uFEFF"]) {
      const { data } = input(text);
      for (const source of [{ data }, { url: `data:text/plain;base64,${data}` }]) {
        const result = readText({ mime: "text/plain", ...source });
        expect(result).toEqual({ ok: true, value: { bytes: new TextEncoder().encode(text), mime: "text/plain", text: "", display: "", lines: 0, bom: !!text } });
      }
    }
    expect(() => readInlineBytes({ mime: "text/plain", data: "" }, "text/plain", 5)).toThrow("invalid");
    for (const source of [{ data: "" }, { url: "data:image/png;base64," }]) expect(readRaster({ mime: "image/png", ...source })).toEqual({ ok: false, reason: "invalid" });
  });

  it("preserves original bytes and Copy newlines, strips only one initial BOM and leaves markup literal", () => {
    const text = '\uFEFF\uFEFFCafé\t世界🙂\r\nمرحبا e\u0301\r<script>alert(1)</script>\n# [source](https://example.test)\n';
    const result = readText(input(text, "text/markdown"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({ mime: "text/markdown", text: text.slice(1), display: text.slice(1).replace(/\r\n?/g, "\n"), lines: 5, bom: true });
      expect(Buffer.from(result.value.bytes).toString("base64")).toBe(input(text).data);
      expect(result.value.bytes.buffer).toBeInstanceOf(ArrayBuffer);
    }
    expect(readText(input("a\uFEFFb"))).toMatchObject({ ok: true, value: { text: "a\uFEFFb", bom: false } });
  });

  it.each([["a", 1], ["\n", 2], ["\r", 2], ["\r\n", 2], ["a\r\n", 2], ["a\nb\rc\r\nd", 4], ["\r\r\n\n", 4]] as const)("counts logical rows in %j", (text, lines) => {
    expect(readText(input(text))).toMatchObject({ ok: true, value: { text, display: text.replace(/\r\n?/g, "\n"), lines } });
  });

  it("admits only exact bare text MIME, case-insensitively, never by filename", () => {
    for (const mime of ["text/plain", "TEXT/PLAIN", "text/markdown", "tExT/MarkDown"]) {
      expect(isTextMime(mime)).toBe(true);
      expect(readText({ mime, url: `DATA:${mime};BASE64,YQ==` })).toMatchObject({ ok: true, value: { mime: mime.toLowerCase(), text: "a" } });
    }
    for (const mime of ["", "application/octet-stream", "text/html", "text/x-markdown", "text/plain;charset=utf-8", "text/markdown; charset=utf-8", " text/plain", "text/plain ", "text/plain\n", "text/markdown\r\n", "text/plain\0"]) {
      expect(isTextMime(mime)).toBe(false);
      const saved = { ...input("a", mime), filename: "note.txt" };
      expect(readText(saved)).toEqual({ ok: false, reason: "unsupported" });
    }
  });

  it("refuses ambiguous sources, unsafe URLs, MIME mismatch and malformed field types", () => {
    for (const source of [{}, { data: "", url: "data:text/plain;base64," }, { data: "YQ==", url: "data:text/plain;base64,YQ==" },
      ...["https://example.test/a.txt", "file:///a.txt", "blob:cortex://app/file", "/a.txt", "data:text/plain,YQ==", "data:text/plain;charset=utf-8;base64,YQ==", "data:text/plain ;base64,YQ=="].map((url) => ({ url }))]) {
      expect(readText({ mime: "text/plain", ...source })).toEqual({ ok: false, reason: "unsupported" });
    }
    expect(readText({ mime: "text/plain", url: "data:text/markdown;base64,YQ==" })).toEqual({ ok: false, reason: "invalid" });
    for (const malformed of [null, { mime: 1, data: "" }, { mime: "text/plain", data: 0 }, { mime: "text/plain", url: null }]) expect(readText(malformed as unknown as Parameters<typeof readText>[0])).toEqual({ ok: false, reason: "invalid" });
    for (const mime of ["text/plain", "image/gif", "image/svg+xml"]) expect(readRaster({ mime: "image/png", url: `data:${mime};base64,YQ==` })).toEqual({ ok: false, reason: "unsupported" });
    expect(readRaster({ mime: "image/png", url: "data:image/jpeg;base64,YQ==" })).toEqual({ ok: false, reason: "invalid" });
  });

  it("accepts canonical padded/unpadded tails, rejecting whitespace and nonzero pad bits before atob", () => {
    for (const [data, text] of [["Zg==", "f"], ["Zg", "f"], ["Zm8=", "fo"], ["Zm8", "fo"], ["Zm9v", "foo"]]) expect(readText({ mime: "text/plain", data })).toMatchObject({ ok: true, value: { text } });
    const decode = vi.spyOn(globalThis, "atob");
    try {
      for (const data of ["A", "=", "A===", "Zg=", "Zg===", "Z=g=", "Zh==", "Zh", "Zm9=", "Zm9", "Zm 9v", "Zg==\n", "\tZg==", "_w==", "-w==", "data:text/plain;base64,Zg=="]) expect(readText({ mime: "text/plain", data })).toEqual({ ok: false, reason: "invalid" });
      expect(decode).not.toHaveBeenCalled();
    } finally { decode.mockRestore(); }
  });

  it("refuses invalid, overlong, surrogate and truncated UTF-8 plus UTF-16 BOMs", () => {
    for (const bytes of [[0x80], [0xc0, 0xaf], [0xe0, 0x80, 0x80], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xf5, 0x80, 0x80, 0x80], [0xc2], [0xe2, 0x82], [0xff, 0xfe, 0x61, 0], [0xfe, 0xff, 0, 0x61]]) {
      expect(readText({ mime: "text/plain", data: Buffer.from(bytes).toString("base64") })).toEqual({ ok: false, reason: "invalid" });
    }
  });

  it("refuses C0/DEL except tabs and line breaks, preserving other valid Unicode", () => {
    for (const unit of [...Array.from({ length: 32 }, (_, i) => i), 127].filter((n) => ![9, 10, 13].includes(n))) expect(readText(input(`a${String.fromCharCode(unit)}b`))).toEqual({ ok: false, reason: "unsupported" });
    const text = "\t \u0085\u009b\u2028\u2029\u202e";
    expect(readText(input(text))).toMatchObject({ ok: true, value: { text, display: text, lines: 1 } });
  });

  it("enforces inclusive 50,000-row and 100,000-UTF-16-unit row ceilings", () => {
    for (const newline of ["\n", "\r", "\r\n"]) {
      expect(readText(input(newline.repeat(49_999)))).toMatchObject({ ok: true, value: { lines: 50_000 } });
      expect(readText(input(newline.repeat(50_000)))).toEqual({ ok: false, reason: "tooLarge" });
    }
    for (const row of ["x".repeat(100_000), "🙂".repeat(50_000)]) {
      expect(readText(input(`${row}\r\n${row}`))).toMatchObject({ ok: true, value: { lines: 2 } });
      expect(readText(input(`${row}x`))).toEqual({ ok: false, reason: "tooLarge" });
    }
  });

  it("admits exactly five million original bytes, counting BOM, and refuses excess before atob", () => {
    const text = `${"x".repeat(99_999)}\n`.repeat(50);
    for (const original of [text, `\uFEFF${text.slice(0, -3)}`]) {
      const result = readText(input(original));
      expect(result.ok).toBe(true);
      if (result.ok) { expect(result.value.bytes.length).toBe(5_000_000); expect(Buffer.from(result.value.bytes).toString("base64")).toBe(input(original).data); }
    }
    const decode = vi.spyOn(globalThis, "atob"), excess = "A".repeat(6_666_668);
    try {
      for (const data of [excess, `${excess}A`]) {
        expect(readText({ mime: "text/plain", data })).toEqual({ ok: false, reason: "tooLarge" });
        expect(readText({ mime: "text/plain", url: `data:text/plain;base64,${data}` })).toEqual({ ok: false, reason: "tooLarge" });
      }
      expect(decode).not.toHaveBeenCalled();
    } finally { decode.mockRestore(); }
  });

  it("forces safe bounded text extensions without changing the saved source", () => {
    for (const [name, want] of [[undefined, "file"], ["", "file"], ["../../notes.exe", "notes"], ["C:\\tmp\\notes.html", "notes"], ["bad\0\n\u202egnp.exe", "badgnp"], ["NUL.txt", "file"], ["LPT¹.a.txt", "file"], ["...", "file"], ["<a>|?:.html", "a"], ["notes.tar.gz", "notes.tar"]]) {
      expect(textFilename(name, "text/plain")).toBe(`${want}.txt`); expect(textFilename(name, "text/markdown")).toBe(`${want}.md`);
    }
    expect(textFilename("雪🙂".repeat(100), "text/markdown")).toBe(`${"雪🙂".repeat(30)}.md`);
    expect(new TextEncoder().encode(textFilename("🙂".repeat(100), "text/plain")).length).toBeLessThanOrEqual(255);
  });
});
