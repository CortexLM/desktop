/**
 * Custom matchers for enhanced testing, registered against `vitest`.
 */

import { expect } from 'vitest';

/** Shape every matcher returns; mirrors Bun's and Vitest's matcher contract. */
export interface MatcherResult {
  pass: boolean;
  message: () => string;
  actual?: unknown;
  expected?: unknown;
}

/**
 * Check if a value is within a range
 */
function toBeWithinRange(
  received: number,
  floor: number,
  ceiling: number
): MatcherResult {
  const pass = received >= floor && received <= ceiling;
  
  return {
    pass,
    message: () =>
      pass
        ? `Expected ${received} not to be within range ${floor} - ${ceiling}`
        : `Expected ${received} to be within range ${floor} - ${ceiling}`,
    actual: received,
    expected: `${floor} - ${ceiling}`
  };
}

/**
 * Check if string contains all substrings
 */
function toContainAll(received: string, substrings: string[]): MatcherResult {
  const missing = substrings.filter(s => !received.includes(s));
  const pass = missing.length === 0;

  return {
    pass,
    message: () =>
      pass
        ? `Expected string not to contain all: ${substrings.join(', ')}`
        : `Expected string to contain all: ${substrings.join(', ')}, but missing: ${missing.join(', ')}`,
    actual: received,
    expected: substrings
  };
}

/**
 * Check if array contains items matching predicate
 */
function toContainItemMatching<T>(
  received: T[],
  predicate: (item: T) => boolean
): MatcherResult {
  const pass = received.some(predicate);

  return {
    pass,
    message: () =>
      pass
        ? 'Expected array not to contain matching item'
        : 'Expected array to contain at least one matching item',
    actual: received,
    expected: 'item matching predicate'
  };
}

/**
 * Check if function throws with specific message
 */
async function toThrowWithMessage(
  received: () => any,
  expectedMessage: string | RegExp
): Promise<MatcherResult> {
  let thrownError: Error | undefined;
  
  try {
    await received();
  } catch (error) {
    thrownError = error as Error;
  }

  if (!thrownError) {
    return {
      pass: false,
      message: () => 'Expected function to throw an error',
      actual: undefined,
      expected: expectedMessage
    };
  }

  const pass =
    typeof expectedMessage === 'string'
      ? thrownError.message.includes(expectedMessage)
      : expectedMessage.test(thrownError.message);

  return {
    pass,
    message: () =>
      pass
        ? `Expected error message not to match: ${expectedMessage}`
        : `Expected error message to match: ${expectedMessage}, but got: ${thrownError.message}`,
    actual: thrownError.message,
    expected: expectedMessage
  };
}

/**
 * Description récursive d'une forme attendue : un nom de type primitif
 * (`'string'`, `'number'`, ...) ou un objet imbriqué de la même forme.
 */
export type StructureSpec = { [key: string]: string | StructureSpec };

/**
 * Check if value has valid structure
 */
function toMatchStructure(received: unknown, structure: StructureSpec): MatcherResult {
  function checkStructure(obj: unknown, struct: StructureSpec, path = ''): string[] {
    const errors: string[] = [];

    if (obj === null || typeof obj !== 'object') {
      return [`${path || 'value'}: expected an object, got ${obj === null ? 'null' : typeof obj}`];
    }

    const record = obj as Record<string, unknown>;

    for (const key in struct) {
      const fullPath = path ? `${path}.${key}` : key;

      if (!(key in record)) {
        errors.push(`Missing key: ${fullPath}`);
        continue;
      }

      const expectedType = struct[key];
      const actualValue = record[key];

      if (typeof expectedType === 'string') {
        if (typeof actualValue !== expectedType) {
          errors.push(`${fullPath}: expected ${expectedType}, got ${typeof actualValue}`);
        }
      } else {
        errors.push(...checkStructure(actualValue, expectedType, fullPath));
      }
    }

    return errors;
  }

  const errors = checkStructure(received, structure);
  const pass = errors.length === 0;

  return {
    pass,
    message: () =>
      pass
        ? 'Expected object not to match structure'
        : `Expected object to match structure:\n${errors.join('\n')}`,
    actual: received,
    expected: structure
  };
}

/**
 * Check if async function resolves within time
 */
async function toResolveWithin(
  received: () => Promise<unknown>,
  timeMs: number
): Promise<MatcherResult> {
  const start = Date.now();
  let resolved = false;
  let error: Error | undefined;

  try {
    await received();
    resolved = true;
  } catch (e) {
    error = e as Error;
  }

  const elapsed = Date.now() - start;
  const pass = resolved && elapsed <= timeMs;

  return {
    pass,
    message: () =>
      !resolved
        ? `Promise rejected with: ${error?.message}`
        : pass
        ? `Expected promise not to resolve within ${timeMs}ms (resolved in ${elapsed}ms)`
        : `Expected promise to resolve within ${timeMs}ms but took ${elapsed}ms`,
    actual: elapsed,
    expected: timeMs
  };
}

/**
 * Check if value matches type
 */
function toBeOfType(received: unknown, expectedType: string): MatcherResult {
  const actualType = Array.isArray(received)
    ? 'array'
    : received === null
    ? 'null'
    : typeof received;

  const pass = actualType === expectedType;

  return {
    pass,
    message: () =>
      pass
        ? `Expected value not to be of type ${expectedType}`
        : `Expected value to be of type ${expectedType}, but got ${actualType}`,
    actual: actualType,
    expected: expectedType
  };
}

/**
 * Register all custom matchers
 */
export function registerCustomMatchers() {
  expect.extend({
    toBeWithinRange,
    toContainAll,
    toContainItemMatching,
    toThrowWithMessage,
    toMatchStructure,
    toResolveWithin,
    toBeOfType
  });
}

// TypeScript declarations for custom matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeWithinRange(floor: number, ceiling: number): T;
    toContainAll(substrings: string[]): T;
    toContainItemMatching<U>(predicate: (item: U) => boolean): T;
    toThrowWithMessage(message: string | RegExp): Promise<T>;
    toMatchStructure(structure: StructureSpec): T;
    toResolveWithin(timeMs: number): Promise<T>;
    toBeOfType(type: string): T;
  }
  
  interface AsymmetricMatchersContaining {
    toBeWithinRange(floor: number, ceiling: number): void;
    toContainAll(substrings: string[]): void;
    toContainItemMatching<U>(predicate: (item: U) => boolean): void;
    toThrowWithMessage(message: string | RegExp): void;
    toMatchStructure(structure: StructureSpec): void;
    toResolveWithin(timeMs: number): void;
    toBeOfType(type: string): void;
  }
}
