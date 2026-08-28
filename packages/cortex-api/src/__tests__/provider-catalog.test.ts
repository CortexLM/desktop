import { describe, expect, it } from 'vitest';

import { PROVIDER_CATALOG, providerById } from '../provider-catalog.ts';

describe('PROVIDER_CATALOG', () => {
  it('lists Cortex first so GET /v1/models is the default catalogue', () => {
    expect(PROVIDER_CATALOG[0]?.id).toBe('cortex');
    expect(PROVIDER_CATALOG[0]?.modelsPath).toBe('/v1/models');
  });

  it('never embeds a real-looking key in a placeholder', () => {
    for (const entry of PROVIDER_CATALOG) {
      if (!entry.placeholder) continue;
      expect(entry.placeholder.endsWith('…'), entry.id).toBe(true);
    }
  });

  it('resolves a known id and misses an unknown one', () => {
    expect(providerById('ollama')?.auth).toBe('none');
    expect(providerById('missing')).toBeUndefined();
  });
});
