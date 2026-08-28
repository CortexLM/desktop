/**
 * Test doubles are never a live farm or session.
 *
 * Set `CORTEX_ALLOW_TEST_DOUBLES=1` in the test runner. Production code must
 * use `createHttpProductSurface` and the real realtime clients.
 */

export const TEST_DOUBLES_FLAG = 'CORTEX_ALLOW_TEST_DOUBLES';

export function testDoublesAllowed(): boolean {
  return process.env[TEST_DOUBLES_FLAG] === '1';
}

export function assertTestDoublesAllowed(name: string): void {
  if (testDoublesAllowed()) return;
  throw new Error(
    `${name} is a test double. Set ${TEST_DOUBLES_FLAG}=1 in the test runner. It is not a live farm or session.`,
  );
}
