/**
 * Performance benchmarks for AI providers
 */

import { describe } from 'vitest';
import { bench } from './bench-harness';
import { createMockAIProvider } from '@cortex-ide/test-utils';

describe('AI Provider Performance', () => {
  bench('chat completion - small prompt', async () => {
    const provider = createMockAIProvider();
    provider.mockResponse({
      content: 'Simple response',
      model: 'test-model'
    });

    await provider.chat([
      { role: 'user', content: 'Hello' }
    ]);
  }, { metric: 'ai_chat_small' });

  bench('chat completion - large prompt', async () => {
    const provider = createMockAIProvider();
    provider.mockResponse({
      content: 'A'.repeat(1000),
      model: 'test-model'
    });

    const largePrompt = 'B'.repeat(5000);
    await provider.chat([
      { role: 'user', content: largePrompt }
    ]);
  }, { metric: 'ai_chat_large' });

  bench('streaming response', async () => {
    const provider = createMockAIProvider();
    provider.mockResponse({
      content: 'Streaming response with multiple chunks',
      model: 'test-model'
    });

    const stream = provider.stream([
      { role: 'user', content: 'Stream test' }
    ]);

    for await (const chunk of stream) {
      // Process chunk
    }
  }, { metric: 'ai_stream' });

  bench('batch requests', async () => {
    const provider = createMockAIProvider();
    
    const promises = Array.from({ length: 10 }, (_, i) => {
      provider.mockResponse({
        content: `Response ${i}`,
        model: 'test-model'
      });
      
      return provider.chat([
        { role: 'user', content: `Request ${i}` }
      ]);
    });

    await Promise.all(promises);
  }, { metric: 'ai_chat_batch_10' });
});
