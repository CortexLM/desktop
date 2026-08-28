/**
 * Boot isolation: evaluating this module must not load `node-pty`.
 *
 * A static `import 'node-pty'` here is what used to kill Electron before
 * `app.whenReady()` when the addon was built for Node's ABI (or missing).
 * This file deliberately does not `vi.mock('node-pty')` — if the native
 * import returns, this suite fails on load in environments without the addon.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  TerminalService,
  getTerminalService,
  resetTerminalService,
} from '../terminal-service';

describe('TerminalService module load', () => {
  afterEach(() => {
    resetTerminalService();
  });

  it('constructs and returns the singleton without spawning a PTY', () => {
    expect(() => new TerminalService()).not.toThrow();
    expect(() => getTerminalService()).not.toThrow();
    expect(getTerminalService().listTerminals()).toEqual([]);
  });
});
