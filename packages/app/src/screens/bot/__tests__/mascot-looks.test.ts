import { describe, expect, it } from 'vitest';

import {
  displayFace,
  EYE_IVORY,
  lookSwatch,
  MASCOT_LOOKS,
  PEBBLE_PATH,
  resolveMascotMotion,
  RESTING_TILT_DEG,
  restingTilt,
  TILT_MIN_PX,
} from '../mascot-looks.ts';

describe('mascot looks', () => {
  it('ships six named looks with a dark lift and ivory eyes', () => {
    expect(MASCOT_LOOKS.map((look) => look.id)).toEqual([
      'meadow',
      'teal',
      'terracotta',
      'amber',
      'plum',
      'slate',
    ]);
    expect(lookSwatch('meadow')).toEqual({
      id: 'meadow',
      label: 'Meadow',
      light: '#1f4945',
      dark: '#2e6b64',
    });
    expect(lookSwatch('teal').light).toBe('#3f958c');
    expect(EYE_IVORY).toBe('#faf8f4');
    expect(MASCOT_LOOKS.every((look) => look.dark !== look.light)).toBe(true);
  });

  it('uses one curved pebble, not a triangle', () => {
    expect(PEBBLE_PATH).toContain('C');
    expect(PEBBLE_PATH.toLowerCase()).not.toContain('l ');
    expect(PEBBLE_PATH.match(/M/g)?.length).toBe(1);
  });

  it('keeps resting tilt at ±5° and suppresses it below 48px', () => {
    expect(Math.abs(restingTilt('mst_left', TILT_MIN_PX))).toBe(RESTING_TILT_DEG);
    expect(restingTilt('mst_left', TILT_MIN_PX - 1)).toBe(0);
    expect(restingTilt('mst_left', TILT_MIN_PX)).not.toBe(restingTilt('mst_right', TILT_MIN_PX));
  });
});

describe('mascot motion', () => {
  it('maps busy to working and unread to notify', () => {
    expect(resolveMascotMotion({ computer: 'running' })).toBe('working');
    expect(resolveMascotMotion({ sending: true })).toBe('working');
    expect(resolveMascotMotion({ computer: 'waking' })).toBe('thinking');
    expect(resolveMascotMotion({ unread: true })).toBe('notify');
    expect(resolveMascotMotion({ celebrating: true, unread: true })).toBe('success');
    expect(resolveMascotMotion({})).toBe('idle');
  });

  it('overrides the resting face for live states', () => {
    expect(displayFace('idle', 'working')).toBe('slit');
    expect(displayFace('idle', 'notify')).toBe('wink');
    expect(displayFace('idle', 'success')).toBe('smile');
    expect(displayFace('wink', 'idle')).toBe('wink');
    expect(displayFace('slit', 'thinking')).toBe('slit');
  });
});
