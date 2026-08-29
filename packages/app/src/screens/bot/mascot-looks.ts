/**
 * Cortex Bot mascot identity — one Kernel pebble, six looks, three resting faces.
 *
 * Body colours are the mascot's identity, not chrome: they stay the approved
 * hex on both themes, then lift one step on a dark canvas. Eyes stay ivory.
 * That is the same exception as a brand mark (`.rules/03-responsive.md` § 3.4).
 */

import type { ComputerStatus, MascotFace, MascotLook } from '../../state/bot-map.ts';

export type { MascotFace, MascotLook };

export type MascotMotion = 'idle' | 'thinking' | 'working' | 'success' | 'notify';

export interface MascotLookSwatch {
  id: MascotLook;
  label: string;
  light: string;
  dark: string;
}

export const EYE_IVORY = '#faf8f4';
export const PUPIL_INK = '#1a1815';
export const TILT_MIN_PX = 48;
export const RESTING_TILT_DEG = 5;

/** Single organic pebble path (100×100). Curves, not a triangle, no gradient. */
export const PEBBLE_PATH =
  'M51 9 C70 7 89 20 93 40 C97 60 89 82 70 91 C52 99 28 96 16 80 C5 65 8 42 18 28 C28 14 40 11 51 9 Z';

export const MASCOT_LOOKS: readonly MascotLookSwatch[] = [
  { id: 'meadow', label: 'Meadow', light: '#1f4945', dark: '#2e6b64' },
  { id: 'teal', label: 'Teal', light: '#3f958c', dark: '#4ca89e' },
  { id: 'terracotta', label: 'Terracotta', light: '#b4622d', dark: '#c97a45' },
  { id: 'amber', label: 'Amber', light: '#ce8b57', dark: '#d99e6f' },
  { id: 'plum', label: 'Plum', light: '#7a5c7e', dark: '#937297' },
  { id: 'slate', label: 'Slate', light: '#4a5568', dark: '#64748b' },
];

export const MASCOT_FACES: readonly { id: MascotFace; label: string }[] = [
  { id: 'idle', label: 'Open eyes' },
  { id: 'slit', label: 'Narrow' },
  { id: 'wink', label: 'Wink' },
];

export function lookSwatch(id: MascotLook): MascotLookSwatch {
  return MASCOT_LOOKS.find((look) => look.id === id) ?? MASCOT_LOOKS[0]!;
}

/**
 * Resting tilt is identity, applied outside state motion.
 * Suppressed below 48px so a list chip does not read as a rotated square.
 */
export function restingTilt(seed: string, size: number): number {
  if (!seed || size < TILT_MIN_PX) return 0;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return hash % 2 === 0 ? -RESTING_TILT_DEG : RESTING_TILT_DEG;
}

export function displayFace(resting: MascotFace, motion: MascotMotion): MascotFace | 'smile' {
  if (motion === 'working') return 'slit';
  if (motion === 'notify') return 'wink';
  if (motion === 'success') return 'smile';
  return resting;
}

export function resolveMascotMotion(input: {
  computer?: ComputerStatus;
  unread?: boolean;
  sending?: boolean;
  celebrating?: boolean;
}): MascotMotion {
  if (input.celebrating) return 'success';
  if (input.sending || input.computer === 'running') return 'working';
  if (input.computer === 'waking') return 'thinking';
  if (input.unread) return 'notify';
  return 'idle';
}

export function lookCssVars(look: MascotLook): Record<string, string> {
  const swatch = lookSwatch(look);
  return {
    '--mascot-look': swatch.light,
    '--mascot-look-dark': swatch.dark,
    '--mascot-eye': EYE_IVORY,
    '--mascot-pupil': PUPIL_INK,
  };
}
