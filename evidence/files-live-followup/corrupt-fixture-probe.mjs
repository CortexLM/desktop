import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd(), out = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(path.join(repo, 'package.json'));
const { _electron: electron } = require('@playwright/test');
const rasterFile = path.join(repo, 'packages/app/src/screens/files/raster.ts');
const { readRaster } = await import(pathToFileURL(rasterFile).href);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pin = () => {
  const renderer = path.join(repo, 'packages/app/dist');
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  return Object.fromEntries([path.join(repo, 'packages/desktop/dist/main.cjs'), path.join(repo, 'packages/desktop/dist/preload.cjs'), rasterFile, path.join(repo, 'tests/e2e/files-live.spec.ts'), ...walk(renderer)].map((p) => [path.relative(repo, p), sha(fs.readFileSync(p))]));
};
// Preserve SOF/SOS/entropy/EOI; remove only the indicated length-delimited JPEG tables.
function removeTables(bytes, markers) {
  const chunks = [bytes.subarray(0, 2)]; let at = 2;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) throw new Error('Unexpected JPEG marker framing');
    const begin = at; while (bytes[at] === 0xff) at++;
    const marker = bytes[at++];
    if (marker === 0xda) { chunks.push(bytes.subarray(begin)); break; }
    const end = at + bytes.readUInt16BE(at);
    if (!markers.includes(marker)) chunks.push(bytes.subarray(begin, end));
    at = end;
  }
  return Buffer.concat(chunks);
}
// Keep a genuine VP8/VP8L dimension header; rebuild correct RIFF/chunk framing.
function webpPayload(bytes, onlyHeader) {
  for (let at = 12; at + 8 <= bytes.length;) {
    const tag = bytes.toString('ascii', at, at + 4), size = bytes.readUInt32LE(at + 4), start = at + 8;
    if (tag === 'VP8 ' || tag === 'VP8L') {
      const headerSize = tag === 'VP8 ' ? 10 : 5, length = onlyHeader ? headerSize : size;
      const result = Buffer.alloc(20 + length + length % 2);
      result.write('RIFF'); result.writeUInt32LE(result.length - 8, 4); result.write('WEBP', 8); result.write(tag, 12); result.writeUInt32LE(length, 16);
      bytes.copy(result, 20, start, start + headerSize);
      return result;
    }
    at = start + size + size % 2;
  }
  throw new Error('Canvas produced no VP8/VP8L payload');
}

const before = pin(), started = new Date().toISOString();
const env = { ...process.env, CORTEX_DATA_DIR: `${out}/engine`, CORTEX_CATALOG_URL: 'data:application/json,%7B%7D', CORTEX_START_HASH: '#/about', CORTEX_LOCALE: 'en' };
delete env.CORTEX_RENDERER_URL; delete env.CORTEX_TEST_PROVIDER_BASEURL;
const app = await electron.launch({ args: [path.join(repo, 'packages/desktop/dist/main.cjs'), '--no-sandbox', `--user-data-dir=${out}/renderer`], env, timeout: 20000 });
let receipt;
try {
  const page = await app.firstWindow(), requests = [];
  page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  const controls = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 120;
    const context = canvas.getContext('2d'); context.fillStyle = '#dc321e'; context.fillRect(0, 0, 240, 120);
    return ['image/jpeg', 'image/webp'].map((mime) => ({ mime, url: canvas.toDataURL(mime, 0.9) }));
  });
  for (const control of controls) if (!control.url.startsWith(`data:${control.mime};base64,`)) throw new Error('Native fixture encoder unavailable');
  const [jpeg, webp] = controls.map(({ url }) => Buffer.from(url.split(',')[1], 'base64'));
  const fixtures = [
    { name: 'jpeg-control', mime: 'image/jpeg', bytes: jpeg },
    { name: 'webp-control', mime: 'image/webp', bytes: webp },
    { name: 'jpeg-no-quantization', mime: 'image/jpeg', bytes: removeTables(jpeg, [0xdb]) },
    { name: 'jpeg-no-tables', mime: 'image/jpeg', bytes: removeTables(jpeg, [0xdb, 0xc4]) },
    { name: 'webp-header-only', mime: 'image/webp', bytes: webpPayload(webp, true) },
    { name: 'webp-zero-payload', mime: 'image/webp', bytes: webpPayload(webp, false) },
  ].map(({ name, mime, bytes }) => {
    const data = bytes.toString('base64'), parsed = readRaster({ mime, data });
    const file = `${name}.${mime === 'image/jpeg' ? 'jpg' : 'webp'}`;
    fs.writeFileSync(path.join(out, file), bytes, { flag: 'wx' });
    return { name, mime, file, data, fileBytes: bytes.length, sha256: sha(bytes), preflight: parsed.ok ? { ok: true, dimensions: [parsed.value.width, parsed.value.height], bytesIdentical: Buffer.from(parsed.value.bytes).equals(bytes) } : parsed };
  });
  fs.writeFileSync(`${out}/fixtures.json`, JSON.stringify(fixtures, null, 2) + '\n', { flag: 'wx' });
  const native = await page.evaluate(async (fixtures) => {
    const decode = HTMLImageElement.prototype.decode, nativeDecode = Function.prototype.toString.call(decode);
    const rows = [];
    for (const { name, mime, data } of fixtures) {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)), url = URL.createObjectURL(new Blob([bytes], { type: mime })), image = new Image();
      image.src = url; let timer;
      const result = await Promise.race([
        decode.call(image).then(() => ({ decoded: true, error: null }), (error) => ({ decoded: false, error: { name: error.name, message: error.message } })),
        new Promise((resolve) => { timer = setTimeout(() => resolve({ decoded: null, error: { name: 'ProbeTimeout', message: '5000 ms decode ceiling' } }), 5000); }),
      ]);
      clearTimeout(timer); rows.push({ name, ...result, dimensions: [image.naturalWidth, image.naturalHeight] }); image.src = ''; URL.revokeObjectURL(url);
    }
    return { nativeDecode, rows, userAgent: navigator.userAgent };
  }, fixtures.map(({ name, mime, data }) => ({ name, mime, data })));
  receipt = { started, finished: new Date().toISOString(), scope: 'One native decoder batch; no fixture engine writes, no app assertions or mocked decoding.', versions: await app.evaluate(() => process.versions), nativeDecode: native.nativeDecode, userAgent: native.userAgent, observedRendererHttpRequests: requests, fixtures: fixtures.map(({ data: _data, ...fixture }) => ({ ...fixture, native: native.rows.find((r) => r.name === fixture.name) })), pinsBefore: before };
} finally { await app.close(); }
receipt.pinsAfter = pin(); receipt.sourcesAndBuildUnchanged = JSON.stringify(receipt.pinsBefore) === JSON.stringify(receipt.pinsAfter);
fs.writeFileSync(`${out}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ unchanged: receipt.sourcesAndBuildUnchanged, nativeDecode: receipt.nativeDecode, fixtures: receipt.fixtures.map(({ name, sha256, preflight, native }) => ({ name, sha256, preflight, native })) }));
if (!receipt.sourcesAndBuildUnchanged || !receipt.fixtures.slice(0, 2).every((f) => f.preflight.ok && f.native.decoded === true) || !receipt.fixtures.slice(2).some((f) => f.preflight.ok && f.native.decoded === false)) process.exitCode = 1;
