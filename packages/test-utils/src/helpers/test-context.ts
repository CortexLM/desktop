/**
 * Test context management for sharing state across tests
 */

export interface TestContext {
  [key: string]: unknown;
}

const contexts = new Map<string, TestContext>();

/**
 * Create or get a test context
 */
export function createContext(name: string): TestContext {
  if (!contexts.has(name)) {
    contexts.set(name, {});
  }
  return contexts.get(name)!;
}

/**
 * Get existing context
 */
export function getContext(name: string): TestContext | undefined {
  return contexts.get(name);
}

/**
 * Clear a specific context
 */
export function clearContext(name: string): void {
  contexts.delete(name);
}

/**
 * Clear all contexts
 */
export function clearAllContexts(): void {
  contexts.clear();
}

/**
 * Set value in context
 */
export function setContextValue(contextName: string, key: string, value: unknown): void {
  const context = createContext(contextName);
  context[key] = value;
}

/**
 * Get value from context
 *
 * Contexts store `unknown` (values come from `setContextValue`), so the caller's
 * `T` is an assertion about what was stored, not something the store can prove.
 * The cast is where that assertion is made explicit.
 */
export function getContextValue<T = unknown>(contextName: string, key: string): T | undefined {
  const context = getContext(contextName);
  const value = context?.[key];
  return value === undefined ? undefined : (value as T);
}
