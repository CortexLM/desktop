/**
 * Mock factory for AI providers
 */

/** Un message de conversation, tel que les providers le reçoivent. */
export interface MockChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MockAIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: 'stop' | 'length' | 'content_filter';
}

/**
 * Create a mock AI provider
 *
 * `overrides` remplace n'importe quel membre du provider retourné : typé
 * `Record<string, unknown>` plutôt qu'`any` pour que l'objet de base garde son
 * inférence.
 */
export function createMockAIProvider(overrides: Record<string, unknown> = {}) {
  const responses: MockAIResponse[] = [];
  let callCount = 0;

  return {
    name: 'mock-provider',
    chat: mock(async (_messages: MockChatMessage[]) => {
      callCount++;
      const response = responses[callCount - 1] || {
        content: `Mock response ${callCount}`,
        model: 'mock-model',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        }
      };
      return response;
    }),
    stream: mock(async function* (_messages: MockChatMessage[]) {
      callCount++;
      const response = responses[callCount - 1] || { content: 'Mock stream response' };
      const words = response.content.split(' ');
      for (const word of words) {
        yield { content: word + ' ', done: false };
      }
      yield { content: '', done: true };
    }),
    
    // Helper methods
    mockResponse: (response: MockAIResponse) => {
      responses.push(response);
    },
    mockResponses: (newResponses: MockAIResponse[]) => {
      responses.push(...newResponses);
    },
    getCallCount: () => callCount,
    reset: () => {
      responses.length = 0;
      callCount = 0;
    },
    ...overrides
  };
}

/**
 * Create mock OpenAI provider
 */
export function createMockOpenAI() {
  return createMockAIProvider({
    name: 'openai',
    models: ['gpt-4', 'gpt-3.5-turbo']
  });
}

/**
 * Create mock Anthropic provider
 */
export function createMockAnthropic() {
  return createMockAIProvider({
    name: 'anthropic',
    models: ['claude-3-opus', 'claude-3-sonnet']
  });
}

/**
 * Create mock Grok provider
 */
export function createMockGrok() {
  return createMockAIProvider({
    name: 'grok',
    models: ['grok-2']
  });
}

// Re-export vi for convenience
import { vi } from 'vitest';

// `mock(fn)` was Bun's spy factory; `vi.fn(fn)` is the Vitest equivalent.
// Typed explicitly: an inferred type resolves into vitest's hoisted
// `@vitest/spy` path, which `tsc` rejects as non-portable (TS2742).
const mock: typeof vi.fn = vi.fn;
export { vi };
