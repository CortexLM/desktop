/**
 * Vitest global setup for the `main` package.
 *
 * Only the `electron` mock is needed: `main` runs in the `node` environment and
 * does not touch the DOM.
 *
 * Importing the module is what registers the mock — `electron-mock.ts` calls
 * `vi.mock('electron', ...)` at module scope. Setup files are fully evaluated
 * before any test file is imported, so the mock is in the registry before a test
 * module can link against `electron`.
 */

import './electron-mock';
