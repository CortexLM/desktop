/**
 * Thin compatibility shims for the former `bun:test` API surface.
 *
 * The repo standardised on Vitest as the single test runner. These aliases keep
 * `mock()` / `spyOn()` call sites working without rewriting every helper.
 *
 * NOTE: Bun's `mock.module()` has no drop-in equivalent here — module mocking
 * must use `vi.mock()` directly in the test file, because Vitest hoists
 * `vi.mock` calls above imports. That is intentionally NOT shimmed: a silent
 * no-op would be worse than a compile error.
 */

import { vi } from 'vitest';

/**
 * Equivalent of Bun's `mock(fn)` — creates a spy-wrapped function.
 *
 * Typed explicitly: an inferred type here resolves into vitest's hoisted
 * `@vitest/spy` path, which `tsc` rejects as non-portable (TS2742).
 */
export const fn: typeof vi.fn = vi.fn;

/** Equivalent of Bun's `spyOn(obj, key)`. */
export const spyOn: typeof vi.spyOn = vi.spyOn;
