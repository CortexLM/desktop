import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(`${process.cwd()}/node_modules/playwright/index.mjs`).href);
const { expect } = await import(pathToFileURL(`${process.cwd()}/node_modules/@playwright/test/index.mjs`).href);
const browser = await chromium.connectOverCDP('http://127.0.0.1:19444');
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('cortex://app/'));
assert(page); const initial = page.url(), result = { scope: 'Single native measurement diagnosis; no product/style modification', checks: [] };
const call = async (method, url, body) => page.evaluate(async ({ method, url, body }) => {
  const r = await window.cortex.request({ method, url: `cortex://local${url}`, headers: body ? [['content-type', 'application/json']] : [], body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: JSON.parse(r.body) };
}, { method, url, body });
try {
  await page.goto('cortex://app/index.html#/settings?section=providers&theme=light'); await page.reload();
  await page.locator('[data-testid=provider-row][data-provider-id=fake]').click();
  const input = page.getByTestId('provider-key-input'), save = page.getByTestId('provider-key-save'), enable = page.getByRole('switch', { name: 'Enable', exact: true });
  await input.fill('sk-test-original-1111'); await save.click(); await expect(input).toHaveValue('');
  await input.fill('sk-test-replacement-2222');
  for (const checked of [false, true]) { await enable.click(); await expect(enable).toBeChecked({ checked }); await expect(input).toHaveValue('sk-test-replacement-2222'); }
  await page.locator('main .content-top').hover(); await expect(page.locator('.toast')).toHaveCount(0);
  await page.locator('.systeme-provider-key').scrollIntoViewIfNeeded(); await input.click();
  await page.evaluate(() => document.fonts.ready);
  result.checks = await page.evaluate(() => {
    const form = document.querySelector('.systeme-provider-key'), enabled = document.querySelector('[role=switch][aria-label=Enable]');
    const targets = [form.querySelector('.ttl'), form.querySelector('.sub'), form.querySelector('input'), form.querySelector('button'), enabled.closest('.li').querySelector('.ttl'), enabled];
    return targets.map(el => {
      let left = 0, top = 0, right = innerWidth, bottom = innerHeight, opacity = 1; const ancestors = [];
      const box = b => [b.left, b.top, b.right, b.bottom];
      for (let node = el; node; node = node.parentElement) {
        const s = getComputedStyle(node), b = node.getBoundingClientRect(); opacity *= s.visibility === 'visible' && s.display !== 'none' ? Number(s.opacity) : 0;
        if (/^(auto|scroll|hidden|clip)$/.test(s.overflowX)) { left = Math.max(left, b.left + node.clientLeft); right = Math.min(right, b.left + node.clientLeft + node.clientWidth); }
        if (/^(auto|scroll|hidden|clip)$/.test(s.overflowY)) { top = Math.max(top, b.top + node.clientTop); bottom = Math.min(bottom, b.top + node.clientTop + node.clientHeight); }
        ancestors.push({ tag: node.tagName, className: node.className, own: node === el, overflow: [s.overflowX, s.overflowY], box: box(b), client: [node.clientLeft, node.clientTop, node.clientWidth, node.clientHeight], effectiveClip: [left, top, right, bottom] });
      }
      const inside = b => b.width > 0 && b.height > 0 && b.left >= left - .5 && b.top >= top - .5 && b.right <= right + .5 && b.bottom <= bottom + .5;
      const r = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el); const ink = [...range.getClientRects()].filter(b => b.width && b.height), disabled = el.matches(':disabled');
      return { tag: el.tagName, text: el instanceof HTMLInputElement ? '[password input]' : el.textContent, bounds: box(r), effectiveClip: [left, top, right, bottom], opacity, disabled, inside: inside(r), ink: ink.map(box), visible: inside(r) && (opacity === 1 || (disabled && opacity > 0)) && (el instanceof HTMLInputElement || el.matches('button[aria-label], [role="switch"][aria-label]') || (ink.length > 0 && ink.every(inside))), hit: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)), ancestors };
    });
  });
} finally {
  result.removed = await call('DELETE', '/api/providers/fake/key');
  result.restored = await call('PATCH', '/api/providers/fake', { enabled: true });
  assert.deepEqual(result.restored, { status: 200, body: { providerID: 'fake', enabled: true, hasKey: false } });
  await page.goto(initial);
  fs.writeFileSync('/tmp/opencode/provider-native-geometry.json', JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify(result.checks.map(({ tag, text, bounds, effectiveClip, inside, visible, hit }) => ({ tag, text, bounds, effectiveClip, inside, visible, hit }))));
process.exit(0);
