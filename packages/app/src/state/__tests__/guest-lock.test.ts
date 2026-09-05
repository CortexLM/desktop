import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestUpgrade = vi.fn();

vi.mock('../../shell/overlay-host.tsx', () => ({
  requestUpgrade: (...args: unknown[]) => requestUpgrade(...args),
}));

const { enterProduct, guestBlocked, GUEST_CODE_BOT } = await import('../guest-lock.ts');

describe('guestBlocked', () => {
  beforeEach(() => {
    requestUpgrade.mockReset();
  });

  it('lets a signed-in user through without a modal', () => {
    expect(guestBlocked(true)).toBe(false);
    expect(requestUpgrade).not.toHaveBeenCalled();
  });

  it('raises the sign-in modal and blocks unsigned Cloud/Bot use', () => {
    expect(guestBlocked(false)).toBe(true);
    expect(requestUpgrade).toHaveBeenCalledWith(GUEST_CODE_BOT);
  });
});

describe('enterProduct', () => {
  beforeEach(() => {
    requestUpgrade.mockReset();
  });

  it('still opens Code so This PC stays usable unsigned', () => {
    const go = vi.fn();
    enterProduct('code', false, go);
    expect(go).toHaveBeenCalledWith('/code');
    expect(requestUpgrade).not.toHaveBeenCalled();
  });

  it('modals leftover Bot create without hiding the surface', () => {
    const go = vi.fn();
    enterProduct('bot', false, go);
    expect(go).toHaveBeenCalledWith('/bot');
    expect(requestUpgrade).toHaveBeenCalledWith(GUEST_CODE_BOT);
  });

  it('does not modal Chat', () => {
    const go = vi.fn();
    enterProduct('chat', false, go);
    expect(go).toHaveBeenCalledWith('/');
    expect(requestUpgrade).not.toHaveBeenCalled();
  });
});
