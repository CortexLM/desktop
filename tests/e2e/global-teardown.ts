/**
 * Global teardown for E2E tests
 *
 * Nothing suite-wide is left to clean up: the workspace and `userData`
 * directories are per-test now, and each is removed by the fixture that created
 * it (`tests/e2e/fixtures/electron.ts`). Cleaning them here would be too late
 * anyway — a test's directories must be gone before the suite ends, not after.
 *
 * The hook is kept as the declared `globalTeardown` so there is one obvious
 * place for anything genuinely suite-wide later.
 */
export default async function globalTeardown() {
  console.log('🧹 Global Teardown: nothing to clean (fixtures are per-test).');
}
