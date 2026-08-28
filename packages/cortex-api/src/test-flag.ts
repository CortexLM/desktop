/**
 * Test doubles are never a live farm or session.
 *
 * Set `CORTEX_ALLOW_TEST_DOUBLES=1` in the test runner. Production code must
 * use `createHttpProductSurface` and the real realtime clients.
 */

export const TEST_DOUBLES_FLAG = 'CORTEX_ALLOW_TEST_DOUBLES';

type EnvBag = { env?: Record<string, string | undefined> };

function processEnv(): Record<string, string | undefined> | undefined {
  return (globalThis as { process?: EnvBag }).process?.env;
}

export function testDoublesAllowed(): boolean {
  return processEnv()?.[TEST_DOUBLES_FLAG] === '1';
}

export function assertTestDoublesAllowed(name: string): void {
  if (testDoublesAllowed()) return;
  throw new Error(
    `${name} is a test double. Set ${TEST_DOUBLES_FLAG}=1 in the test runner. It is not a live farm or session.`,
  );
}

/** Test-only. Restores the previous value when the callback finishes. */
export function withTestDoublesFlag<T>(value: string | undefined, run: () => T): T {
  const env = processEnv();
  const previous = env?.[TEST_DOUBLES_FLAG];
  if (env) {
    if (value === undefined) delete env[TEST_DOUBLES_FLAG];
    else env[TEST_DOUBLES_FLAG] = value;
  }
  try {
    return run();
  } finally {
    if (env) {
      if (previous === undefined) delete env[TEST_DOUBLES_FLAG];
      else env[TEST_DOUBLES_FLAG] = previous;
    }
  }
}
