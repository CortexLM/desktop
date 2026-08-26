/**
 * Global setup for E2E tests
 *
 * Builds the app. That is all it does.
 *
 * The build has to happen here rather than being assumed: the specs launch Electron against
 * `packages/main/dist/index.js`, which loads `packages/app/dist/index.html`. Running them
 * against a stale dist is the failure mode where the suite passes while testing the previous
 * commit's renderer.
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
