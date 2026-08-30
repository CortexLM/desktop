/**
 * English product copy, with a French catalog for translators.
 *
 * The UI renders English. `catalogs/fr.json` is the source for a future locale
 * switch — it is not loaded at runtime today.
 */

import en from './catalogs/en.json';

export type CopyKey = keyof typeof en;

export const copy: Record<CopyKey, string> = en;
