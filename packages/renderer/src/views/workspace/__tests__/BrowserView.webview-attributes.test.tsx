/**
 * BrowserView `<webview>` attributes — regression guard.
 *
 * This element has already shipped misconfigured: it carried
 * `nodeintegration="false"`, which **enabled** Node integration in the guest
 * page. On a `<webview>`, a boolean attribute is enabled by *presence*, not by
 * value — the string `"false"` is a present value. The configuration looked
 * defensive and did the opposite, and nothing failed.
 *
 * So this suite asserts on the rendered DOM rather than on the source text: the
 * question is what attributes the element actually ends up carrying.
 *
 * Scope, stated plainly: this is the *renderer* half and it is not the real
 * barrier. The barrier is `will-attach-webview` in `packages/main/src/security.ts`
 * (see `packages/main/src/__tests__/webview-confinement.test.ts`), which
 * overwrites the guest's `webPreferences` at attach time no matter what this JSX
 * asks for. This file exists so that a dangerous attribute reappearing here is
 * still caught at the point it is introduced, and so the two descriptions of the
 * guest cannot drift apart silently.
 *
 * jsdom has no Electron, so `<webview>` renders as an unknown element. That is
 * sufficient: attributes are the subject, and jsdom records them faithfully.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BrowserView } from '../BrowserView';

/** The rendered `<webview>` element. */
function renderWebview(props: { initialUrl?: string } = {}) {
  const { container } = render(<BrowserView {...props} />);
  const webview = container.querySelector('webview');

  expect(webview, 'BrowserView must render a <webview> element').not.toBeNull();
  return webview!;
}

/**
 * The `<webview ... />` opening tag as written in the source, with `//` comment
 * lines removed.
 *
 * Needed because the DOM is not the whole story. React 18 does not know
 * `allowpopups` as a boolean DOM attribute, so a bare `allowpopups` in JSX is
 * dropped with a console warning and never reaches the DOM — a mutation adding
 * it back survives every DOM assertion. That silence is an accident of React's
 * unknown-attribute handling, not a protection: a *string* value
 * (`allowpopups="true"`, and notably `nodeintegration="false"`) does reach the
 * DOM, and React 19 changed how unknown attributes are handled. So presence in
 * the JSX is checked directly, independently of how React chooses to serialize
 * it.
 *
 * Comment lines are stripped so the explanatory comments in BrowserView.tsx —
 * which necessarily name these attributes to explain why they are absent — do
 * not read as the attributes themselves.
 */
function webviewSourceTag(): string {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'BrowserView.tsx'),
    'utf8'
  );

  // Anchored on the JSX element, not on the string `<webview`: that substring
  // also appears in this file's doc comments, and matching the first occurrence
  // silently scanned ~5000 characters of prose instead of the element — every
  // assertion then passed without examining any attribute at all.
  const match = source.match(/\n(\s*)<webview$/m);
  expect(match, 'no <webview> JSX element found in BrowserView.tsx').not.toBeNull();

  const start = source.indexOf(match![0]) + 1;
  const end = source.indexOf('/>', start);
  expect(end, 'unterminated <webview> element in BrowserView.tsx').toBeGreaterThan(start);

  const tag = source.slice(start, end + 2);

  // Sanity check: the extracted region must be the element, not a chunk of the
  // file. Without this a future refactor could quietly break the anchor above
  // and restore the vacuous-pass behaviour.
  expect(tag.length, 'extracted <webview> tag is implausibly large').toBeLessThan(2000);
  expect(tag).toContain('ref={');

  return (
    tag
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
      // The `webpreferences` *value* legitimately names these flags
      // (`nodeIntegration=no`), which would read as the attribute itself. Its
      // contents are asserted separately, so the value is blanked here and only
      // attribute positions remain.
      .replace(/webpreferences="[^"]*"/gi, 'webpreferences=""')
  );
}

/**
 * Attributes that hand privilege to the guest page. Each is enabled by presence,
 * so the only safe state is absent — `="false"` is what caused the original bug.
 */
const DANGEROUS_ATTRIBUTES = [
  'nodeintegration',
  'nodeintegrationinsubframes',
  'disablewebsecurity',
  'allowpopups',
  'plugins',
  'enableblinkfeatures',
  'preload',
];

describe('BrowserView <webview> security attributes', () => {
  it.each(DANGEROUS_ATTRIBUTES)('does not carry %s in any form', (attribute) => {
    // `toBeNull` and not `toBe('false')`: the assertion is about *presence*.
    // An attribute set to the string "false" would enable the flag, so a test
    // asserting `="false"` would have passed on the original bug.
    expect(renderWebview().getAttribute(attribute)).toBeNull();
  });

  it.each(DANGEROUS_ATTRIBUTES)('does not write %s in the JSX either', (attribute) => {
    // The DOM check above misses a bare `allowpopups`, which React 18 drops
    // before it reaches the DOM. Intent in the source is what is checked here.
    expect(webviewSourceTag().toLowerCase()).not.toContain(attribute);
  });

  it('does not carry nodeintegration even as the literal string "false"', () => {
    // Named explicitly because this is the exact regression: the value that was
    // there before, and that read as enabled.
    const webview = renderWebview();
    expect(webview.hasAttribute('nodeintegration')).toBe(false);
    expect(webview.outerHTML).not.toContain('nodeintegration');
  });

  it('runs the guest in a non-default session partition', () => {
    // Without a partition the guest shares the app's cookies, localStorage and
    // granted permissions.
    const partition = renderWebview().getAttribute('partition');
    expect(partition).toBeTruthy();
    expect(partition).toMatch(/^persist:/);
    expect(partition).not.toBe('persist:');
  });

  it('agrees with the partition the main process forces', () => {
    // Duplicated constant (renderer cannot import from main). If they drift the
    // main process still wins, but the drift is worth failing on.
    expect(renderWebview().getAttribute('partition')).toBe('persist:cortex-webview-preview');
  });

  it('requests context isolation and sandboxing through webpreferences', () => {
    const webpreferences = renderWebview().getAttribute('webpreferences') ?? '';
    expect(webpreferences).toContain('contextIsolation=yes');
    expect(webpreferences).toContain('sandbox=yes');
    expect(webpreferences).toContain('webSecurity=yes');
  });

  it('never disables a protection through the webpreferences string', () => {
    // This attribute is a free-form string, so it is its own way to turn things
    // off — `contextIsolation=no` here would undo the flag above.
    const webpreferences = (renderWebview().getAttribute('webpreferences') ?? '').toLowerCase();
    for (const dangerous of [
      'contextisolation=no',
      'sandbox=no',
      'nodeintegration=yes',
      'websecurity=no',
      'allowrunninginsecurecontent=yes',
    ]) {
      expect(webpreferences, `webpreferences must not contain ${dangerous}`).not.toContain(
        dangerous
      );
    }
  });

  it('starts on about:blank rather than remote content', () => {
    expect(renderWebview().getAttribute('src')).toBe('about:blank');
  });
});

describe('BrowserView still supports the local development preview', () => {
  // The webview is the dev preview. Hardening that broke this would be a
  // regression, so the localhost path is asserted rather than assumed.
  it.each([
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://192.168.1.20:8080',
  ])('accepts %s as an initial src', (initialUrl) => {
    expect(renderWebview({ initialUrl }).getAttribute('src')).toBe(initialUrl);
  });

  it('renders the address bar seeded with the initial url', () => {
    const { container } = render(<BrowserView initialUrl="http://localhost:3000" />);
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect((input as HTMLInputElement).value).toBe('http://localhost:3000');
  });
});

/**
 * The address bar normalises what the user types before handing it to
 * `loadURL`. Those normalised strings are the input to the main process's
 * navigation policy, so this is the seam where a hardening change could break
 * the preview: a policy that only admits what the address bar cannot produce is
 * a broken preview.
 *
 * The expectations below are the exact strings asserted as *allowed* in
 * `packages/main/src/__tests__/webview-confinement.test.ts`
 * ("still allows the local preview at ..."). The two suites must be read
 * together; neither can prove the round trip alone, since they run in different
 * processes.
 */
describe('address bar produces URLs the main-process policy admits', () => {
  /** Type into the address bar, press Enter, return the URL passed to loadURL. */
  function navigateTo(typed: string): string | undefined {
    const { container } = render(<BrowserView />);
    const webview = container.querySelector('webview') as HTMLElement & {
      loadURL?: (url: string) => void;
    };

    // jsdom has no Electron, so the navigation method has to be supplied. The
    // component reads `webviewRef.current` at call time, so assigning after
    // render is enough.
    const loadURL = vi.fn();
    webview.loadURL = loadURL;

    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: typed } });
    fireEvent.keyDown(input, { key: 'Enter' });

    return loadURL.mock.calls[0]?.[0] as string | undefined;
  }

  it.each([
    ['localhost:3000', 'http://localhost:3000'],
    ['localhost:5173/route', 'http://localhost:5173/route'],
    ['127.0.0.1:8080', 'http://127.0.0.1:8080'],
    ['192.168.1.50:4000', 'http://192.168.1.50:4000'],
    ['10.0.0.7:3000', 'http://10.0.0.7:3000'],
    ['172.16.4.9:9000', 'http://172.16.4.9:9000'],
  ])('normalises %j to %j — cleartext http, which the policy admits for local hosts', (typed, expected) => {
    // http, not https: dev servers do not serve TLS. The main policy allows
    // cleartext only for local hostnames, which is what makes this work.
    expect(navigateTo(typed)).toBe(expected);
  });

  it.each([
    ['http://localhost:3000', 'http://localhost:3000'],
    ['file:///home/dev/dist/index.html', 'file:///home/dev/dist/index.html'],
  ])('passes %j through untouched', (typed, expected) => {
    expect(navigateTo(typed)).toBe(expected);
  });

  it('upgrades a bare remote host to https, which the policy admits', () => {
    // Remote cleartext http is refused by the policy; the address bar never
    // produces it for a remote host, so the two agree.
    expect(navigateTo('example.com')).toBe('https://example.com');
  });

  it('does not navigate on empty input', () => {
    expect(navigateTo('   ')).toBeUndefined();
  });
});
