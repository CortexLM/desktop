import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { _electron: electron } = require('@playwright/test');
const root = '/tmp/opencode/files-decode-probe'; fs.mkdirSync(root);
const app = await electron.launch({ args: [path.join(process.cwd(), 'packages/desktop/dist/main.cjs'), '--no-sandbox', `--user-data-dir=${root}/renderer`], env: { ...process.env, CORTEX_DATA_DIR: `${root}/engine`, CORTEX_CATALOG_URL: 'data:application/json,%7B%7D', CORTEX_START_HASH: '#/home', CORTEX_LOCALE: 'en' } });
try {
  const page = await app.firstWindow();
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 120; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#dc321e'; ctx.fillRect(0, 0, 240, 120);
    const original = Uint8Array.from(atob(canvas.toDataURL().split(',')[1]), c => c.charCodeAt(0));
    const crc = bytes => { let n = 0xffffffff; for (const b of bytes) { n ^= b; for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); } return (n ^ 0xffffffff) >>> 0; };
    const rows = [];
    for (const mode of ['original', 'first-byte', 'zero-idat', 'invalid-deflate']) {
      const bytes = original.slice(), v = new DataView(bytes.buffer);
      for (let at = 8; at + 12 <= bytes.length; at += v.getUint32(at) + 12) if (String.fromCharCode(...bytes.slice(at + 4, at + 8)) === 'IDAT') {
        const n = v.getUint32(at);
        if (mode === 'first-byte') bytes[at + 8] ^= 255;
        if (mode === 'zero-idat') bytes.fill(0, at + 8, at + 8 + n);
        if (mode === 'invalid-deflate') { bytes.fill(255, at + 8, at + 8 + n); bytes[at + 8] = 0x78; bytes[at + 9] = 0x9c; }
        v.setUint32(at + 8 + n, crc(bytes.slice(at + 4, at + 8 + n)));
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' })), image = new Image(); image.src = url;
      let decoded = true; try { await image.decode(); } catch { decoded = false; }
      rows.push({ mode, decoded, dimensions: [image.naturalWidth, image.naturalHeight], fileBytes: bytes.length }); URL.revokeObjectURL(url);
    }
    return rows;
  });
  fs.writeFileSync(`${root}/receipt.json`, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
} finally { await app.close(); }
