import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_SCHEME } from '../callback';
import { acquireInstanceLock, registerProtocolClient } from '../register';

describe('registerProtocolClient', () => {
  it('registers the cortex scheme', () => {
    const setAsDefaultProtocolClient = vi.fn(() => true);
    expect(registerProtocolClient({ setAsDefaultProtocolClient }, 'linux')).toBe(true);
    expect(setAsDefaultProtocolClient).toHaveBeenCalledWith(PROTOCOL_SCHEME);
  });

  it('is a no-op when the Electron API is missing (tests)', () => {
    expect(registerProtocolClient({} as never)).toBe(false);
  });
});

describe('acquireInstanceLock', () => {
  it('quits when another instance already owns the lock', () => {
    const quit = vi.fn();
    const requestSingleInstanceLock = vi.fn(() => false);
    expect(acquireInstanceLock({ requestSingleInstanceLock, quit })).toBe(false);
    expect(quit).toHaveBeenCalled();
  });

  it('keeps this instance when the lock is acquired', () => {
    const quit = vi.fn();
    expect(acquireInstanceLock({ requestSingleInstanceLock: () => true, quit })).toBe(true);
    expect(quit).not.toHaveBeenCalled();
  });
});
