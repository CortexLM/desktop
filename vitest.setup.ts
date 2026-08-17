/**
 * Vitest global setup
 */

import { registerCustomMatchers } from '@cortex-ide/test-utils';

// Register custom matchers globally
registerCustomMatchers();

// Set longer timeout for tests
import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Global test setup
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Global test cleanup
});
