import { describe, expect, it } from 'vitest';

import {
  connectSrc,
  DEFAULT_API_ORIGIN,
  socketOrigin,
  withConnectSrc,
} from '../connect-src.ts';

const PAGE = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' https://api.cortex.foundation wss://api.cortex.foundation" />`;

describe('socketOrigin', () => {
  it('maps http and https onto their socket schemes', () => {
    expect(socketOrigin('https://api.cortex.foundation')).toBe('wss://api.cortex.foundation');
    expect(socketOrigin('http://127.0.0.1:8787')).toBe('ws://127.0.0.1:8787');
  });

  it('invents nothing for a scheme it does not know', () => {
    expect(socketOrigin('wss://api.cortex.foundation')).toBeUndefined();
    expect(socketOrigin('file://')).toBeUndefined();
  });
});

describe('connectSrc', () => {
  it('always allows the socket origin, which the hardcoded policy did not', () => {
    // `connect-src https://…` does not authorise `wss://…`, so the realtime socket
    // was blocked and the app silently fell back to read-only SSE.
    expect(connectSrc()).toBe(
      `'self' ${DEFAULT_API_ORIGIN} wss://api.cortex.foundation`,
    );
  });

  it('honours an override and keeps production reachable in the same bundle', () => {
    expect(connectSrc('http://127.0.0.1:8787')).toBe(
      `'self' http://127.0.0.1:8787 ws://127.0.0.1:8787 ${DEFAULT_API_ORIGIN} wss://api.cortex.foundation`,
    );
  });

  it('reduces a URL with a path to its origin', () => {
    expect(connectSrc('https://staging.cortex.foundation/v1/')).toContain(
      'https://staging.cortex.foundation wss://staging.cortex.foundation',
    );
  });

  it('falls back to the default rather than emitting a malformed source', () => {
    // A malformed entry makes CSP ignore the whole source list, which would quietly
    // open the page up instead of failing.
    for (const bad of ['', '   ', 'not a url']) {
      expect(connectSrc(bad)).toBe(`'self' ${DEFAULT_API_ORIGIN} wss://api.cortex.foundation`);
    }
  });
});

describe('withConnectSrc', () => {
  it('rewrites only the connect-src directive', () => {
    const rewritten = withConnectSrc(PAGE, 'http://127.0.0.1:8787');

    expect(rewritten).toContain("default-src 'self'");
    expect(rewritten).toContain("connect-src 'self' http://127.0.0.1:8787 ws://127.0.0.1:8787");
    expect(rewritten).toMatch(/connect-src[^"]*"\s*\/>/);
  });

  it('ignores an earlier connect-src outside the meta tag', () => {
    // The real page mentions `connect-src` in the comment above the tag. Rewriting
    // the first match spliced the policy into that comment and left the tag alone —
    // a broken document that still parsed.
    const withComment = `<!-- connect-src is rewritten at build time -->\n${PAGE}`;

    const rewritten = withConnectSrc(withComment, 'http://127.0.0.1:8787');

    expect(rewritten).toContain('<!-- connect-src is rewritten at build time -->');
    expect(rewritten).toContain("connect-src 'self' http://127.0.0.1:8787 ws://127.0.0.1:8787");
    expect(rewritten).toContain('http-equiv="Content-Security-Policy"');
  });

  it('leaves a page with no policy untouched', () => {
    expect(withConnectSrc('<html></html>')).toBe('<html></html>');
  });
});
