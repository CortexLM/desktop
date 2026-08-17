import { describe, expect, it } from 'vitest';
import { FOUNDATIONS_SHORTCUTS, surfaceForDigit } from '../foundations-keys';

describe('foundations-keys', () => {
  it('lists the Foundations keyboard contract', () => {
    const labels = FOUNDATIONS_SHORTCUTS.map((row) => row[0]);
    expect(labels).toEqual(
      expect.arrayContaining(['⌘K', '⌘P', '⌘J', '⌘B', '⌘1–9', '⌘M', '⌘D', '⌘⇧R', '⌘↵', '⌘/', '⌘,'])
    );
  });

  it('maps ⌘1–9 onto the live-session rail order', () => {
    expect(surfaceForDigit('1')).toBe('git');
    expect(surfaceForDigit('4')).toBe('terminal');
    expect(surfaceForDigit('9')).toBe('browser');
    expect(surfaceForDigit('0')).toBeUndefined();
  });
});
