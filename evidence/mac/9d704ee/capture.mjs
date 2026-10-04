import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const { chromium } = await import(path.join(process.cwd(), 'node_modules/playwright/index.mjs'));
const [out] = process.argv.slice(2);
assert(out);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:19444');
const page = browser.contexts()[0].pages().find(p => p.url().startsWith('cortex://app/'));
assert(page);
const ssh = command => execFileSync('ssh', ['-o', 'BatchMode=yes', 'mac-live', command], { encoding: 'utf8' }).trim();
const errors = [], captures = [];
page.on('pageerror', e => errors.push(e.message));
const key = 'sk-test-native-layout-5678';
for (const theme of ['light', 'dark']) {
  ssh(`osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${theme === 'dark'}' -e 'tell application "System Events" to tell process "Cortex" to set size of window 1 to {960, 640}'`);
  await page.goto(`cortex://app/index.html#/settings?section=providers&theme=${theme}`);
  await page.waitForFunction(() => innerWidth === 960 && innerHeight === 640);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (await page.locator('.window').getAttribute('data-sidebar') === 'hidden') await page.getByRole('button', { name: 'Show sidebar', exact: true }).click();
  await page.getByTestId('provider-search').fill('fake');
  await page.locator('[data-testid=provider-row][data-provider-id=fake]').click();
  await page.getByTestId('provider-key-input').fill(key);
  await page.getByTestId('provider-key-save').click();
  await page.getByText('Saved · 5678', { exact: true }).waitFor();
  await page.locator('main .content-top').hover();
  await page.waitForFunction(() => document.querySelectorAll('.toast').length === 0);
  assert.equal(await page.getByTestId('provider-key-input').inputValue(), '');
  assert(!(await page.content()).includes(key));
  await page.getByTestId('provider-key-input').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.getByTestId('provider-key-input').evaluate(input => {
    const form = input.closest('form'), grow = form.querySelector('.grow');
    const items = [grow, input, form.querySelector('button')].map(el => el.getBoundingClientRect());
    const readable = [...grow.children].every(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      const box = el.getBoundingClientRect();
      return [...range.getClientRects()].every(r => r.width > 0 && r.left >= box.left - 1 && r.right <= box.right + 1
        && [r.left + 1, r.x + r.width / 2, r.right - 1].every(x => el.contains(document.elementFromPoint(x, r.y + r.height / 2))));
    });
    return { readable, labelWidth: items[0].width, hintWidth: grow.querySelector('.sub').getBoundingClientRect().width,
      controlsWrapped: items[1].top >= items[0].bottom,
      nonoverlap: items.every((r, i) => items.slice(i + 1).every(b => r.right <= b.left || r.left >= b.right || r.bottom <= b.top || r.top >= b.bottom)),
      inViewport: items.every(r => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight),
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth };
  });
  assert(geometry.readable && geometry.labelWidth > 0 && geometry.hintWidth > 0 && geometry.controlsWrapped && geometry.nonoverlap && geometry.inViewport && geometry.noHorizontalOverflow, JSON.stringify(geometry));
  await page.getByTestId('provider-key-input').click({ trial: true });
  const wid = ssh(`swift -e 'import CoreGraphics; for w in CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]] where w["kCGWindowOwnerName"] as? String == "Cortex" && w["kCGWindowLayer"] as? Int == 0 { print(w["kCGWindowNumber"] as! Int); break }' 2>/dev/null`);
  const response = await fetch(`http://127.0.0.1:19445/${wid}`, { method: 'POST' });
  assert(response.ok);
  const file = `provider-key-${theme}.png`;
  fs.writeFileSync(path.join(out, file), Buffer.from(await response.arrayBuffer()));
  captures.push({ file, theme, width: 960, height: 640, sidebar: await page.locator('.window').getAttribute('data-sidebar'), geometry, keyRedacted: true });
  await page.reload();
  await page.getByTestId('provider-search').fill('fake');
  await page.locator('[data-testid=provider-row][data-provider-id=fake]').click();
  await page.getByText('Saved · 5678', { exact: true }).waitFor();
  captures.at(-1).reloadRetainsHint = true;
}
assert.deepEqual(errors, []);
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ captures, errorsSinceAttach: errors, method: 'OS window capture via screencapture; real save timers; reduced-motion preference' }, null, 2) + '\n');
await browser.close();
console.log('Two native provider key-row captures and save/reload checks passed');
