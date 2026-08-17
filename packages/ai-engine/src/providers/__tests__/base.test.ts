import { describe, it, expect } from 'vitest';
import { AIProvider, AIProviderError, type Message, type ChatOptions, type ChatResponse, type StreamChunk } from '../base';

// Mock implementation for testing
class MockProvider extends AIProvider {
  readonly id = 'mock';
  readonly name = 'Mock Provider';

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    return {
      content: 'Mock response',
      model: 'mock-model',
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
    };
  }

  async *stream(messages: Message[], options?: ChatOptions): AsyncIterableIterator<StreamChunk> {
    yield { content: 'Hello ', done: false };
    yield { content: 'World', done: false };
    yield { content: '', done: true };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  // Expose handleError for testing
  public testHandleError(error: any, context: string): never {
    return this.handleError(error, context);
  }
}

describe('AIProvider Base Class', () => {
  describe('Constructor', () => {
    it('should create provider with empty config', () => {
      const provider = new MockProvider();
      expect(provider.id).toBe('mock');
      expect(provider.name).toBe('Mock Provider');
    });

    it('should create provider with config', () => {
      const provider = new MockProvider({ apiKey: 'test-key', defaultModel: 'test-model' });
      expect(provider).toBeDefined();
    });
  });

  describe('Abstract Methods', () => {
    it('should implement chat method', async () => {
      const provider = new MockProvider();
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const response = await provider.chat(messages);
      
      expect(response).toBeDefined();
      expect(response.content).toBe('Mock response');
      expect(response.model).toBe('mock-model');
      expect(response.usage.totalTokens).toBe(30);
    });

    it('should implement stream method', async () => {
      const provider = new MockProvider();
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const chunks: StreamChunk[] = [];
      
      for await (const chunk of provider.stream(messages)) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBe(3);
      expect(chunks[0].content).toBe('Hello ');
      expect(chunks[0].done).toBe(false);
      expect(chunks[2].done).toBe(true);
    });

    it('should implement isAvailable method', async () => {
      const provider = new MockProvider();
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw AIProviderError with message', () => {
      const provider = new MockProvider();
      const error = new Error('Test error');
      
      expect(() => {
        provider.testHandleError(error, 'test operation');
      }).toThrow(AIProviderError);
      
      try {
        provider.testHandleError(error, 'test operation');
      } catch (e) {
        expect(e).toBeInstanceOf(AIProviderError);
        const providerError = e as AIProviderError;
        expect(providerError.message).toContain('Mock Provider');
        expect(providerError.message).toContain('test operation');
        expect(providerError.message).toContain('Test error');
        expect(providerError.providerId).toBe('mock');
      }
    });

    it('should handle error with status code', () => {
      const provider = new MockProvider();
      const error = { message: 'API error', status: 429 };
      
      try {
        provider.testHandleError(error, 'rate limit');
      } catch (e) {
        const providerError = e as AIProviderError;
        expect(providerError.statusCode).toBe(429);
      }
    });

    it('should handle error with code', () => {
      const provider = new MockProvider();
      const error = { message: 'Invalid request', code: 'invalid_request_error' };
      
      try {
        provider.testHandleError(error, 'validation');
      } catch (e) {
        const providerError = e as AIProviderError;
        expect(providerError.code).toBe('invalid_request_error');
      }
    });

    it('should handle unknown error', () => {
      const provider = new MockProvider();
      const error = { unknown: 'format' };
      
      try {
        provider.testHandleError(error, 'unknown error');
      } catch (e) {
        const providerError = e as AIProviderError;
        expect(providerError.message).toContain('Unknown error');
      }
    });
  });
});

describe('AIProviderError', () => {
  it('should create error with all properties', () => {
    const error = new AIProviderError('Test message', 'test-provider', 'test_code', 400);
    
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AIProviderError');
    expect(error.message).toBe('Test message');
    expect(error.providerId).toBe('test-provider');
    expect(error.code).toBe('test_code');
    expect(error.statusCode).toBe(400);
  });

  it('should create error with minimal properties', () => {
    const error = new AIProviderError('Minimal error', 'minimal-provider');
    
    expect(error.message).toBe('Minimal error');
    expect(error.providerId).toBe('minimal-provider');
    expect(error.code).toBeUndefined();
    expect(error.statusCode).toBeUndefined();
  });
});
