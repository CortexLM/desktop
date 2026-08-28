import { describe, expect, it } from 'vitest';

import { unwrapList } from '../envelopes.ts';

describe('unwrapList', () => {
  it('returns a bare array unchanged', () => {
    const rows = [{ id: 'k1' }];
    expect(unwrapList(rows)).toBe(rows);
  });

  it('pulls a list out of { data } or { api_keys }', () => {
    expect(unwrapList({ data: [{ id: 'k1' }] })).toEqual([{ id: 'k1' }]);
    expect(unwrapList({ api_keys: [{ id: 'k2' }] })).toEqual([{ id: 'k2' }]);
  });

  it('leaves an unknown envelope for the schema to reject', () => {
    expect(unwrapList({ keys: [] })).toEqual({ keys: [] });
    expect(unwrapList(null)).toBeNull();
    expect(unwrapList('nope')).toBe('nope');
  });
});
