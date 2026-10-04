import { attachmentFilename, readInlineBytes } from "./bytes";

export type SavedText = { bytes: Uint8Array<ArrayBuffer>; mime: "text/plain" | "text/markdown"; text: string; display: string; lines: number; bom: boolean };
type Reason = "unsupported" | "invalid" | "tooLarge";

export function isTextMime(mime: string): boolean {
  return typeof mime === "string" && ["text/plain", "text/markdown"].includes(mime.toLowerCase());
}

/** ponytail: bounded UTF-8 source only; other encodings need an explicit policy, not a fallback. */
export function readText(input: { mime: string; data?: string; url?: string }): { ok: true; value: SavedText } | { ok: false; reason: Reason } {
  try {
    if (!input || typeof input.mime !== "string") throw "invalid";
    if (!isTextMime(input.mime)) throw "unsupported";
    const mime = input.mime.toLowerCase() as SavedText["mime"], bytes = readInlineBytes(input, mime, 5_000_000, true);
    const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    let lines = text.length ? 1 : 0, width = 0;
    // Count before normalization/splitting; CRLF is one break and surrogate pairs are two UTF-16 units.
    for (let i = 0; i < text.length; i++) {
      const unit = text.charCodeAt(i);
      if (unit < 32 && unit !== 9 && unit !== 10 && unit !== 13 || unit === 127) throw "unsupported";
      if (unit === 13 || unit === 10) {
        if (unit === 13 && text.charCodeAt(i + 1) === 10) i++;
        width = 0;
        if (++lines > 50_000) throw "tooLarge";
      } else if (++width > 100_000) throw "tooLarge";
    }
    return { ok: true, value: { bytes, mime, text, display: text.replace(/\r\n?/g, "\n"), lines, bom } };
  } catch (reason) { return { ok: false, reason: reason === "unsupported" || reason === "tooLarge" ? reason : "invalid" }; }
}

export function textFilename(name: string | undefined, mime: SavedText["mime"]): string {
  return attachmentFilename(name, mime === "text/markdown" ? "md" : "txt", "file");
}
