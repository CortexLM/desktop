/**
 * Global setup for E2E tests
 *
 * Builds the Electron app. That is all it does.
 *
 * It used to also create one shared workspace for the whole suite. That
 * workspace is now created per test by the `workspacePath` fixture
 * (`tests/e2e/fixtures/workspace.ts`), because sharing one Git repository across
 * four parallel workers made execution order part of the contract: a spec that
 * commits everything leaves the repo clean for whoever runs next, and the specs
 * guarded by `if (hasChanges)` then pass without asserting anything.
 */
import { execSync } from 'node:child_process';

export default async function globalSetup() {
  console.log('🔧 Global Setup: Building Electron app...');

  try {
    execSync('bun run build', {
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    console.log('✅ Electron app built successfully');
  } catch (error) {
    console.error('❌ Failed to build Electron app:', error);
    throw error;
  }
}
