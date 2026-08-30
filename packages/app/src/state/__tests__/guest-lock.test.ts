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

  it('raises the sign-in modal and blocks unsigned Code/Bot use', () => {
    expect(guestBlocked(false)).toBe(true);
    expect(requestUpgrade).toHaveBeenCalledWith(GUEST_CODE_BOT);
  });
});

describe('enterProduct', () => {
  beforeEach(() => {
    requestUpgrade.mockReset();
  });

  it('still opens Code so the surface stays shown and locked', () => {
    const go = vi.fn();
    enterProduct('code', false, go);
    expect(go).toHaveBeenCalledWith('/code');
    expect(requestUpgrade).toHaveBeenCalledWith(GUEST_CODE_BOT);
  });

  it('does not modal Chat', () => {
    const go = vi.fn();
    enterProduct('chat', false, go);
    expect(go).toHaveBeenCalledWith('/');
    expect(requestUpgrade).not.toHaveBeenCalled();
  });
});
