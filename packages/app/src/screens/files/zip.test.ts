import { describe, expect, it } from "vitest";
import { listZip, readZipText, xmlText } from "./zip";

// Stored (method 0) single-entry zip built by hand: local header, data, central directory, end record.
function storedZip(name: string, body: string) {
  const n = new TextEncoder().encode(name), d = new TextEncoder().encode(body);
  const local = new DataView(new ArrayBuffer(30)); local.setUint32(0, 0x04034b50, true); local.setUint32(18, d.length, true); local.setUint32(22, d.length, true); local.setUint16(26, n.length, true);
  const cen = new DataView(new ArrayBuffer(46)); cen.setUint32(0, 0x02014b50, true); cen.setUint32(20, d.length, true); cen.setUint32(24, d.length, true); cen.setUint16(28, n.length, true);
  const cenAt = 30 + n.length + d.length, end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, 1, true); end.setUint16(10, 1, true); end.setUint32(12, 46 + n.length, true); end.setUint32(16, cenAt, true);
  return new Blob([local.buffer, n, d, cen.buffer, n, end.buffer]).arrayBuffer();
}

describe("zip", () => {
  it("lists and reads a stored entry", async () => {
    const buf = await storedZip("word/document.xml", "<w:p><w:t>Hello &amp; bye</w:t></w:p><w:p><w:t>Two</w:t></w:p>");
    const [e] = listZip(buf);
    expect(e.name).toBe("word/document.xml");
    expect(xmlText(await readZipText(buf, e))).toBe("Hello & bye\nTwo");
  });
  it("refuses a non-zip", () => { expect(() => listZip(new ArrayBuffer(40))).toThrow(); });
});
