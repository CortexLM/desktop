import { describe, expect, it, vi } from 'vitest';

import { AIProviderRegistry } from '../registry';
import type { AIProvider, ChatResponse, ProviderModel } from '../providers/base';

function fakeProvider(id: string, available = true): AIProvider {
  return {
    id,
    name: id,
    config: { defaultModel: `${id}-default` },
    async chat(): Promise<ChatResponse> {
      return { content: id, model: id, usage: { inputTokens: 0, outputTokens: 0 } };
    },
    async *stream() {
      return;
    },
    async listModels(): Promise<ProviderModel[]> {
      return [{ id: `${id}-1`, displayName: `${id} one` }];
    },
    async isAvailable() {
      return available;
    },
  } as unknown as AIProvider;
}

describe('AIProviderRegistry API', () => {
  it('registers built-in providers that have keys', () => {
    const registry = new AIProviderRegistry({
      openai: { apiKey: 'sk-test' },
      grok: { apiKey: 'xai-test' },
      ollama: { baseUrl: 'http://127.0.0.1:11434' },
      defaultProvider: 'openai',
    });
    expect(registry.hasProviders()).toBe(true);
    expect(registry.getProviderIds()).toEqual(expect.arrayContaining(['openai', 'grok', 'ollama']));
    expect(registry.getDefault()?.id).toBe('openai');
    expect(registry.getDefaultOrThrow().id).toBe('openai');
    expect(registry.getAllProviders().length).toBeGreaterThan(0);
  });

  it('picks the first provider when no default is set', () => {
    const registry = new AIProviderRegistry({ ollama: {} });
    expect(registry.getDefault()?.id).toBe('ollama');
  });

  it('throws when the default is missing or unset', () => {
    const empty = new AIProviderRegistry({});
    expect(empty.getDefault()).toBeUndefined();
    expect(() => empty.getDefaultOrThrow()).toThrow(/No default AI provider/);
    const registry = new AIProviderRegistry({ ollama: {} });
    expect(() => registry.setDefault('missing')).toThrow(/not found/);
  });

  it('reconfigures in place and reports availability', async () => {
    const registry = new AIProviderRegistry({ ollama: {} });
    registry.register(fakeProvider('mock', false));
    registry.reconfigure({ ollama: {} });
    expect(registry.getProvider('mock')).toBeUndefined();
    registry.register(fakeProvider('mock', true));
    expect(await registry.isProviderAvailable('mock')).toBe(true);
    expect(await registry.isProviderAvailable('nope')).toBe(false);
    expect(await registry.getAvailableProviders()).toEqual(expect.arrayContaining(['mock']));
  });

  it('lists models and applies presets', async () => {
    const registry = new AIProviderRegistry({});
    registry.register(fakeProvider('openai'));
    registry.setDefault('openai');
    expect(await registry.listModels()).toEqual([
      expect.objectContaining({ id: 'openai-1', providerId: 'openai' }),
    ]);
    expect(registry.getModelForPreset('fastest')).toBeTypeOf('string');
    expect(registry.getModelForPreset('fastest', 'openai')).toBeTypeOf('string');
    expect(new AIProviderRegistry({}).getModelForPreset('fastest')).toBeUndefined();
    registry.setProviderPreset('openai', 'fastest');
    expect(() => registry.setProviderPreset('missing', 'fastest')).toThrow(/not found/);
    registry.setGlobalPreset('fastest');
  });
});
