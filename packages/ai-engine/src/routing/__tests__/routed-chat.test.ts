/**
 * Tests for the provider-registry bridge.
 */

import { classifyProviderError, routedChat } from '../routed-chat';
import { ModelRouter } from '../model-router';
import { AIProviderError } from '../../providers/base';
import type { ChatOptions, ChatResponse, Message, StreamChunk } from '../../providers/base';
import { AIProvider } from '../../providers/base';
import { AIProviderRegistry } from '../../registry';

class StubProvider extends AIProvider {
  readonly id: string;
  readonly name: string;
  calls: Array<{ model?: string }> = [];

  constructor(
    id: string,
    private readonly behaviour: (model: string | undefined) => ChatResponse | Error
  ) {
    super({});
    this.id = id;
    this.name = id;
  }

  async chat(_messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    this.calls.push({ model: options?.model });
    const result = this.behaviour(options?.model);
    if (result instanceof Error) throw result;
    return result;
  }

  async *stream(): AsyncIterableIterator<StreamChunk> {
    yield { content: '', done: true };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

function response(content: string, model: string): ChatResponse {
  return {
    content,
    model,
    usage: { inputTokens: 1000, outputTokens: 100, totalTokens: 1100 },
  };
}

const MESSAGES: Message[] = [{ role: 'user', content: 'format this file' }];

describe('classifyProviderError', () => {
  it('treats rate limits as transient', () => {
    expect(classifyProviderError(new AIProviderError('rate limited', 'openai', undefined, 429))).toBe('transient');
  });

  it('treats server errors as transient', () => {
    expect(classifyProviderError(new AIProviderError('boom', 'openai', undefined, 503))).toBe('transient');
  });

  it('treats auth failures as fatal', () => {
    expect(classifyProviderError(new AIProviderError('bad key', 'openai', undefined, 401))).toBe('provider-error');
    expect(classifyProviderError(new AIProviderError('forbidden', 'openai', undefined, 403))).toBe('provider-error');
  });

  it('detects context length rejections', () => {
    expect(classifyProviderError(new Error('This model has a maximum context length of 200000 tokens'))).toBe(
      'context-overflow'
    );
  });

  it('detects network failures as transient', () => {
    expect(classifyProviderError(new Error('socket hang up'))).toBe('transient');
    expect(classifyProviderError(new Error('ETIMEDOUT: timeout'))).toBe('transient');
  });

  it('defaults to a fatal provider error', () => {
    expect(classifyProviderError(new Error('something odd'))).toBe('provider-error');
  });

  it('reads a plain status field', () => {
    expect(classifyProviderError({ status: 429, message: 'slow down' })).toBe('transient');
  });
});

describe('routedChat', () => {
  function registryWith(...providers: AIProvider[]): AIProviderRegistry {
    const registry = new AIProviderRegistry();
    for (const provider of providers) registry.register(provider);
    return registry;
  }

  it('calls the model chosen by the router', async () => {
    const openrouter = new StubProvider('openrouter', (model) => response('formatted', model ?? ''));
    const router = new ModelRouter();
    const result = await routedChat(
      router,
      registryWith(openrouter),
      { id: 't1', prompt: 'format this file' },
      MESSAGES
    );

    expect(result.success).toBe(true);
    expect(openrouter.calls[0]?.model).toBe('google/gemini-3.7-flash');
  });

  it('records real token usage from the response', async () => {
    const openrouter = new StubProvider('openrouter', (model) => response('formatted', model ?? ''));
    const router = new ModelRouter();
    await routedChat(router, registryWith(openrouter), { id: 't1', prompt: 'format this file' }, MESSAGES);

    const summary = router.getCostSummary();
    expect(summary.inputTokens).toBe(1000);
    expect(summary.outputTokens).toBe(100);
  });

  it('escalates to the next provider when validation rejects the cheap answer', async () => {
    const openrouter = new StubProvider('openrouter', (model) => response('nope', model ?? ''));
    const anthropic = new StubProvider('anthropic', (model) => response('good answer', model ?? ''));
    const router = new ModelRouter();

    const result = await routedChat(
      router,
      registryWith(openrouter, anthropic),
      { id: 't1', prompt: 'format this file' },
      MESSAGES,
      { validate: (res) => res.content === 'good answer' }
    );

    expect(result.success).toBe(true);
    expect(result.value?.content).toBe('good answer');
    expect(anthropic.calls[0]?.model).toBe('claude-sonnet-4.5');
  });

  it('rejects an empty response by default', async () => {
    const openrouter = new StubProvider('openrouter', (model) => response('   ', model ?? ''));
    const anthropic = new StubProvider('anthropic', (model) => response('real answer', model ?? ''));
    const router = new ModelRouter();

    const result = await routedChat(
      router,
      registryWith(openrouter, anthropic),
      { id: 't1', prompt: 'format this file' },
      MESSAGES
    );

    expect(result.success).toBe(true);
    expect(result.value?.content).toBe('real answer');
  });

  it('stops on an unregistered provider instead of walking every lane', async () => {
    const router = new ModelRouter();
    const result = await routedChat(
      router,
      new AIProviderRegistry(),
      { id: 't1', prompt: 'format this file' },
      MESSAGES
    );

    expect(result.success).toBe(false);
    expect(result.failureKind).toBe('provider-error');
    expect(result.attempts).toHaveLength(1);
  });

  it('retries the same lane on a rate limit rather than escalating', async () => {
    let attempt = 0;
    const openrouter = new StubProvider('openrouter', (model) => {
      attempt += 1;
      if (attempt === 1) return new AIProviderError('rate limited', 'openrouter', undefined, 429);
      return response('formatted', model ?? '');
    });

    const router = new ModelRouter();
    const result = await routedChat(
      router,
      registryWith(openrouter),
      { id: 't1', prompt: 'format this file' },
      MESSAGES
    );

    expect(result.success).toBe(true);
    expect(result.attempts.map((a) => a.tier)).toEqual(['cheap', 'cheap']);
  });

  it('attributes input tokens for a failed call', async () => {
    const openrouter = new StubProvider('openrouter', () => new Error('boom'));
    const router = new ModelRouter();

    await routedChat(router, registryWith(openrouter), { id: 't1', prompt: 'format this file' }, MESSAGES);

    // The prompt was sent and billed even though the call threw.
    expect(router.getCostSummary().inputTokens).toBeGreaterThan(0);
  });

  it('lets a validator name the failure kind', async () => {
    const openrouter = new StubProvider('openrouter', (model) => response('truncated', model ?? ''));
    const anthropic = new StubProvider('anthropic', (model) => response('complete', model ?? ''));
    const router = new ModelRouter();

    const result = await routedChat(
      router,
      registryWith(openrouter, anthropic),
      { id: 't1', prompt: 'format this file' },
      MESSAGES,
      {
        validate: (res) => (res.content === 'complete' ? true : { ok: false, failureKind: 'incomplete' as const }),
      }
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toHaveLength(2);
  });
});
