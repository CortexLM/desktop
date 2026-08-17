#!/usr/bin/env bun
/**
 * Measures the per-keystroke cost the persist middleware adds.
 *
 * `updateTabContent` runs on every Monaco change, and every store write now
 * serialises the session to localStorage. If that cost scales with file size,
 * persistence would make typing in a large file laggy — a regression that no
 * unit test would show. Measured rather than assumed.
 */

import { toPersistedSession } from '../packages/renderer/src/store/editor-session';

function measure(sizeBytes: number, iterations = 200): number {
  const tabs = [
    {
      id: 'tab-1',
      path: '/big.ts',
      language: 'typescript',
      content: 'x'.repeat(sizeBytes),
      isDirty: true,
      isActive: true,
      baselineMtime: 1,
    },
  ];

  // Includes JSON.stringify, which is what the storage layer actually does.
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    JSON.stringify({ state: toPersistedSession(tabs, 'tab-1'), version: 1 });
  }
  return (performance.now() - start) / iterations;
}

console.log('per-write cost of the persist projection + serialisation:\n');
for (const size of [1_000, 10_000, 100_000, 500_000, 2_000_000]) {
  const ms = measure(size, size > 500_000 ? 40 : 200);
  const label = `${(size / 1000).toFixed(0)} KB`.padStart(8);
  console.log(`  ${label}  ${ms.toFixed(3)} ms/write`);
}

console.log('\n10 tabs of 100 KB each:');
const many = Array.from({ length: 10 }, (_, index) => ({
  id: `tab-${index}`,
  path: `/file-${index}.ts`,
  language: 'typescript',
  content: 'x'.repeat(100_000),
  isDirty: index === 0,
  isActive: index === 0,
  baselineMtime: 1,
}));
const start = performance.now();
for (let i = 0; i < 100; i += 1) {
  JSON.stringify({ state: toPersistedSession(many, 'tab-0'), version: 1 });
}
console.log(`  ${((performance.now() - start) / 100).toFixed(3)} ms/write`);
