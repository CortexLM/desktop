/**
 * Does the AI chat path actually produce a session and a usable composer?
 *
 * The activity-bar capture only reached the empty state ("Start an AI chat").
 * That state is reached whether `ai.createSession` works or not, so it proves
 * nothing about the feature. This clicks through and records what happens.
 */

import { test } from '../fixtures/electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'screenshots', 'audit');

test('ai chat session creation', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().replace(/\s+/g, ' ').slice(0, 300));
  });

  await page.evaluate(() => window.localStorage.setItem('cortex-theme', 'dark'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="sidebar"]', { timeout: 60000 });

  await page.locator('[data-testid="sidebar-ai-chat"]').click();
  await page.waitForSelector('[data-testid="ai-chat-panel"]', { timeout: 20000 });
  await page.waitForTimeout(1200);

  // Ask the main process directly first: separates "IPC broken" from
  // "UI never calls it".
  const directIpc = await page.evaluate(async () => {
    try {
      const res = await window.cortex.ai.createSession({
        provider: 'anthropic',
        model: 'claude-sonnet-4',
      });
      return { ok: true, response: res };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  const beforeClick = {
    hasEmptyState: (await page.locator('[data-testid="ai-chat-empty-state"]').count()) > 0,
    sessionRows: await page.locator('[data-testid="ai-chat-panel"] [role="listitem"]').count(),
  };

  // Now the UI path.
  const newChat = page.locator('[data-testid="ai-chat-empty-state"] button').first();
  if ((await newChat.count()) > 0) await newChat.click();
  await page.waitForTimeout(3000);

  const afterClick = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="ai-chat-panel"]') as HTMLElement;
    return {
      stillEmptyState: Boolean(document.querySelector('[data-testid="ai-chat-empty-state"]')),
      hasComposer: Boolean(panel?.querySelector('textarea')),
      composerPlaceholder:
        (panel?.querySelector('textarea') as HTMLTextAreaElement | null)?.placeholder ?? null,
      text: (panel?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 700),
      testIds: Array.from(panel?.querySelectorAll('[data-testid]') ?? [])
        .map((n) => n.getAttribute('data-testid'))
        .filter(Boolean),
      // A toast means the failure was surfaced to the user rather than swallowed.
      toastText:
        (document.querySelector('[data-testid="toast-container"]') as HTMLElement | null)?.innerText
          ?.replace(/\s+/g, ' ')
          .trim() ?? null,
    };
  });

  mkdirSync(join(OUT, 'states'), { recursive: true });
  await page.screenshot({
    path: join(OUT, 'states', 'ai-chat-after-new-session.png'),
    animations: 'disabled',
  });

  // If a composer exists, try sending a message and see whether anything is
  // reported back (no API key is configured in the fixture, so a clear error is
  // the correct outcome; silence is not).
  let sendResult: unknown = 'no composer';
  if (afterClick.hasComposer) {
    const composer = page.locator('[data-testid="ai-chat-panel"] textarea').first();
    await composer.fill('Hello from the audit probe');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);
    sendResult = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="ai-chat-panel"]') as HTMLElement;
      return {
        panelText: (panel?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 900),
        toastText:
          (document.querySelector('[data-testid="toast-container"]') as HTMLElement | null)
            ?.innerText?.replace(/\s+/g, ' ')
            .trim() ?? null,
      };
    });
    await page.screenshot({
      path: join(OUT, 'states', 'ai-chat-after-send.png'),
      animations: 'disabled',
    });
  }

  const report = { directIpc, beforeClick, afterClick, sendResult, consoleErrors };
  writeFileSync(join(OUT, 'ai-chat-probe.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
});
