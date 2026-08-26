import '@testing-library/jest-dom/vitest';

import { afterEach } from 'vitest';
import { cleanup } from '@solidjs/testing-library';

// Solid's testing library does not auto-clean between tests, and a leaked root keeps its
// reactive graph alive - which shows up as one test seeing another's DOM.
afterEach(() => {
  cleanup();
});
