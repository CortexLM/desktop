/**
 * @cortex-ide/test-utils
 * Comprehensive testing utilities for Cortex IDE
 */

export * from './helpers';
export * from './mocks';
export * from './builders';
export * from './matchers';
export * from './fixtures';

// Re-export commonly used testing utilities
export {
  describe,
  it,
  test,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest';

// Back-compat aliases for the previous `bun:test` surface.
// `mock()` -> `vi.fn()`, `spyOn()` -> `vi.spyOn()`, `jest` -> `vi`.
export { vi as jest, vi as mockUtils } from 'vitest';
export { fn as mock, spyOn } from './vitest-compat';
