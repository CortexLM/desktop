import { describe, expect, it } from 'vitest';

import {
  COMPUTER_KIND_LABEL,
  parseComputerKind,
  publicVncTicket,
  sanitizeStreamUrl,
} from '../index.ts';

describe('computer kind', () => {
  it('maps aliases onto This PC / SSH / Cloud and refuses unknowns', () => {
    expect(parseComputerKind('local')).toBe('local');
    expect(parseComputerKind('this-pc')).toBe('local');
    expect(parseComputerKind('farm')).toBe('cloud');
    expect(parseComputerKind('ssh')).toBe('ssh');
    expect(parseComputerKind('mock')).toBeUndefined();
    expect(COMPUTER_KIND_LABEL.local).toBe('This PC');
  });
});

describe('public VNC ticket', () => {
  it('keeps a hash and a safe stream URL, never a password', () => {
    expect(
      publicVncTicket({
        ticket_hash: 'abc',
        password: 'drop',
        vnc_password: 'nope',
        stream_url: 'https://farm.example/novnc/abc?password=x',
      }),
    ).toEqual({ ticket_hash: 'abc', stream_url: 'https://farm.example/novnc/abc' });
  });

  it('drops javascript and websocket stream URLs', () => {
    expect(sanitizeStreamUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeStreamUrl('wss://farm.example/vnc')).toBeUndefined();
    expect(sanitizeStreamUrl('/novnc/abc')).toBe('/novnc/abc');
  });
});
