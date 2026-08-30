import { describe, expect, it } from 'vitest';

import en from '../catalogs/en.json';
import fr from '../catalogs/fr.json';

describe('copy catalogs', () => {
  it('keeps the French catalog in lockstep with English keys', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it('does not name a vendor in either catalog', () => {
    const blob = `${JSON.stringify(en)}\n${JSON.stringify(fr)}`;
    expect(blob).not.toMatch(/Claude|Grok|Cursor|WorkOS|Composio/i);
  });
});
