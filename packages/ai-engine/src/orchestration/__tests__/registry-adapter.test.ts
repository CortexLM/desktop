/**
 * Tests for the registry adapter - wiring the orchestrator to AIProviderRegistry.
 */

import {
  DEFAULT_PROVIDER_CAPACITIES,
  createChatTask,
  registerProviders,
} from '../registry-adapter';
import { InfraAwareOrchestrator } from '../infra-aware-orchestrator';
import { AIProviderRegistry } from '../../registry';
import {
  AIProvider,
  type ChatOptions,
  type ChatResponse,
  type Message,
  type StreamChunk,
} from '../../providers/base';

/** Minimal provider double that records what it was asked to do. */
class StubProvider extends AIProvider {
  readonly id: string;
  readonly name: string;
  calls: Array<{ messages: Message[]; options?: ChatOptions }> = [];

  constructor(id: string, private readonly shouldFail = false) {
    super({ apiKey: 'test' });
    this.id = id;
    this.name = `Stub ${id}`;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    this.calls.push({ messages, options });
    if (this.shouldFail) {
      throw new Error(`${this.id} unavailable`);
    }
    return {
      content: `reply from ${this.id}`,
      model: options?.model ?? 'stub-model',
      usage: { inputTokens: 120, outputTokens: 45, totalTokens: 165 },
    };
  }

  async *stream(): AsyncIterableIterator<StreamChunk> {
    yield { content: 'chunk', done: true };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

describe('registerProviders', () => {
  let orchestrator: InfraAwareOrchestrator;
  let registry: AIProviderRegistry;

  beforeEach(() => {
    orchestrator = new InfraAwareOrchestrator();
    registry = new AIProviderRegistry();
  });

  it('registers every provider from the registry', () => {
    registry.register(new StubProvider('openai'));
    registry.register(new StubProvider('anthropic'));

    const registered = registerProviders(orchestrator, registry);

    expect(registered.sort()).toEqual(['anthropic', 'openai']);
    expect(Object.keys(orchestrator.getSnapshot().providers).sort()).toEqual([
      'anthropic',
      'openai',
    ]);
  });

  it('applies the known capacity profile', () => {
    registry.register(new StubProvider('anthropic'));
    registerProviders(orchestrator, registry);

    const signals = orchestrator.getSnapshot().providers.anthropic!;
    expect(signals.capacity.inputCostPerMillion).toBe(
      DEFAULT_PROVIDER_CAPACITIES.anthropic!.inputCostPerMillion
    );
  });

  it('treats local inference as free', () => {
    registry.register(new StubProvider('ollama'));
    registerProviders(orchestrator, registry);

    const signals = orchestrator.getSnapshot().providers.ollama!;
    expect(signals.capacity.inputCostPerMillion).toBe(0);
    expect(signals.capacity.tokensPerMinute).toBeUndefined();
  });

  it('falls back to a conservative profile for unknown providers', () => {
    registry.register(new StubProvider('mystery'));
    registerProviders(orchestrator, registry);

    const signals = orchestrator.getSnapshot().providers.mystery!;
    expect(signals.capacity.maxConcurrency).toBe(4);
  });

  it('honours capacity overrides', () => {
    registry.register(new StubProvider('openai'));
    registerProviders(orchestrator, registry, {
      openai: { maxConcurrency: 32, tokensPerMinute: 2_000_000 },
    });

    const signals = orchestrator.getSnapshot().providers.openai!;
    expect(signals.capacity.maxConcurrency).toBe(32);
    expect(signals.capacity.tokensPerMinute).toBe(2_000_000);
    // Unspecified fields keep the default profile.
    expect(signals.capacity.inputCostPerMillion).toBe(2.5);
  });

  it('registers nothing for an empty registry', () => {
    expect(registerProviders(orchestrator, registry)).toEqual([]);
  });
});

describe('createChatTask', () => {
  let orchestrator: InfraAwareOrchestrator;
  let registry: AIProviderRegistry;
  let openai: StubProvider;

  const messages: Message[] = [
    { role: 'system', content: 'You are precise.' },
    { role: 'user', content: 'Explain backpressure in one sentence.' },
  ];

  beforeEach(() => {
    orchestrator = new InfraAwareOrchestrator({ retry: { maxAttempts: 1 } });
    registry = new AIProviderRegistry();
    openai = new StubProvider('openai');
    registry.register(openai);
    registerProviders(orchestrator, registry);
  });

  it('estimates input tokens from the messages', () => {
    const task = createChatTask(registry, { id: 'chat-1', messages });
    expect(task.estimatedInputTokens).toBeGreaterThan(0);
  });

  it('defaults estimated output tokens', () => {
    const task = createChatTask(registry, { id: 'chat-1', messages });
    expect(task.estimatedOutputTokens).toBe(1_000);
  });

  it('takes estimated output tokens from maxTokens', () => {
    const task = createChatTask(registry, {
      id: 'chat-1',
      messages,
      chatOptions: { maxTokens: 256 },
    });

    expect(task.estimatedOutputTokens).toBe(256);
  });

  it('runs through the orchestrator and returns the reply', async () => {
    const task = createChatTask(registry, { id: 'chat-1', messages });
    const result = await orchestrator.execute(task);

    expect(result.success).toBe(true);
    expect(result.value).toBe('reply from openai');
    expect(openai.calls).toHaveLength(1);
  });

  it('bills the provider-reported usage rather than the estimate', async () => {
    const task = createChatTask(registry, { id: 'chat-1', messages });
    const result = await orchestrator.execute(task);

    // 120 input at $2.5/M + 45 output at $10/M.
    expect(result.costUsd).toBeCloseTo(120e-6 * 2.5 + 45e-6 * 10, 10);
  });

  it('forwards chat options to the provider', async () => {
    const task = createChatTask(registry, {
      id: 'chat-1',
      messages,
      chatOptions: { model: 'gpt-4.5-turbo', temperature: 0.2 },
    });
    await orchestrator.execute(task);

    expect(openai.calls[0]!.options).toMatchObject({
      model: 'gpt-4.5-turbo',
      temperature: 0.2,
    });
  });

  it('propagates priority, SLA and cache key', () => {
    const task = createChatTask(registry, {
      id: 'chat-1',
      messages,
      priority: 'critical',
      sla: { objective: 'latency' },
      cacheKey: 'repo-prefix',
    });

    expect(task.priority).toBe('critical');
    expect(task.sla).toEqual({ objective: 'latency' });
    expect(task.cacheKey).toBe('repo-prefix');
  });

  it('fails the task when the provider is missing from the registry', async () => {
    const task = createChatTask(new AIProviderRegistry(), { id: 'chat-1', messages });
    const result = await orchestrator.execute(task);

    expect(result.success).toBe(false);
    expect(result.error!.message).toMatch(/not found in registry/);
  });

  it('surfaces provider failures as a failed task', async () => {
    const failing = new AIProviderRegistry();
    failing.register(new StubProvider('openai', true));
    const failingOrchestrator = new InfraAwareOrchestrator({ retry: { maxAttempts: 1 } });
    registerProviders(failingOrchestrator, failing);

    const result = await failingOrchestrator.execute(
      createChatTask(failing, { id: 'chat-1', messages })
    );

    expect(result.success).toBe(false);
    expect(result.error!.message).toMatch(/unavailable/);
  });
});
