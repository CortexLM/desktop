const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const check = (ok: boolean, reason: "unsupported" | "invalid" | "tooLarge" = "invalid") => { if (!ok) throw reason; };

/** The caller gates the MIME; only one canonical inline source is decoded, within its byte budget. */
export function readInlineBytes(input: { mime: string; data?: string; url?: string }, mime: string, maxBytes: number, allowEmpty = false): Uint8Array<ArrayBuffer> {
  try {
    check(!!input && typeof input.mime === "string");
    check((input.data !== undefined) !== (input.url !== undefined), "unsupported");
    let payload = input.data;
    if (input.url !== undefined) {
      check(typeof input.url === "string");
      const header = /^data:([a-z]+\/[a-z0-9.+-]+);base64,/i.exec(input.url);
      check(!!header, "unsupported"); check(header![1].toLowerCase() === mime);
      payload = input.url.slice(header![0].length);
    }
    check(typeof payload === "string");
    const text = payload!;
    check(text.length <= Math.ceil(maxBytes / 3) * 4, "tooLarge");
    const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0, length = text.length - padding, tail = length % 4;
    check((allowEmpty || length > 0) && tail !== 1 && (!padding || text.length % 4 === 0 && padding === 4 - tail));
    check(Math.floor(length * 3 / 4) <= maxBytes, "tooLarge");
    check(!/[^A-Za-z0-9+/]/.test(text.slice(0, length)));
    const last = BASE64.indexOf(text[length - 1]);
    check(tail !== 2 || (last & 15) === 0); check(tail !== 3 || (last & 3) === 0);
    const raw = atob(text), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch (reason) { throw reason === "unsupported" || reason === "tooLarge" ? reason : "invalid"; }
}

export function attachmentFilename(name: string | undefined, extension: string, fallback: string): string {
  const original = typeof name === "string" ? name : "";
  let stem = original.slice(Math.max(original.lastIndexOf("/"), original.lastIndexOf("\\")) + 1)
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>:"|?*]/gu, "").replace(/\.[^.]*$/, "").replace(/^[ .]+/, "");
  // 60 code points plus a trusted short extension fit 255-byte and 255-UTF-16-unit filename limits.
  stem = Array.from(stem.slice(0, 120)).slice(0, 60).join("").replace(/[ .]+$/, "");
  if (!stem || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(stem)) stem = fallback;
  return `${stem}.${extension}`;
}
