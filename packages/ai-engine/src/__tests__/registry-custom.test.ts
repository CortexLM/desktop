import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AIProviderRegistry } from '../registry';
import { CustomProvider } from '../providers/custom-provider';

/**
 * Custom (user-configured) endpoints in the registry, and the aggregated catalogue.
 *
 * A custom provider is not a special case bolted on beside the known ones: it is the same
 * OpenAI-compatible implementation pointed at a different URL. These tests pin the two
 * things that make several of them usable at once - independent ids, and a catalogue that
 * survives one of them being down.
 */

const ENV_KEYS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'OLLAMA_HOST',
  'OLLAMA_ENABLED',
  'GROK_API_KEY',
  'CUSTOM_PROVIDER_BASE_URL',
  'CUSTOM_PROVIDER_API_KEY',
  'CUSTOM_PROVIDER_ID',
  'CUSTOM_PROVIDER_LABEL',
  'CUSTOM_PROVIDER_DEFAULT_MODEL',
  'DEFAULT_AI_PROVIDER',
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
});

describe('custom endpoints', () => {
  it('registers a user-configured endpoint', () => {
    const registry = new AIProviderRegistry({
      custom: [{ baseUrl: 'https://gateway.test/v1', apiKey: 'k', defaultModel: 'm' }],
    });

    expect(registry.getProviderIds()).toEqual(['custom']);
  });

  it('keeps several endpoints side by side', () => {
    // A company gateway and a local model are a normal pairing; a single config field would
    // force a choice between them.
    const registry = new AIProviderRegistry({
      custom: [
        { id: 'gateway', baseUrl: 'https://gateway.test/v1' },
        { id: 'local', baseUrl: 'http://localhost:8000/v1' },
      ],
    });

    expect(registry.getProviderIds()).toEqual(['gateway', 'local']);
  });

  it('skips an entry with no base URL rather than throwing', () => {
    // Stored settings can be half-filled; one incomplete row must not stop the app from
    // registering the rest.
    const registry = new AIProviderRegistry({
      custom: [
        { id: 'incomplete', baseUrl: '' },
        { id: 'valid', baseUrl: 'https://gateway.test/v1' },
      ],
    });

    expect(registry.getProviderIds()).toEqual(['valid']);
  });

  it('lets a custom id deliberately replace a built-in one', () => {
    // Registered last, so pointing `openrouter` at a proxy is an explicit override rather
    // than a conflict whose winner depends on read order.
    const registry = new AIProviderRegistry({
      openrouter: { apiKey: 'k' },
      custom: [{ id: 'openrouter', baseUrl: 'https://proxy.test/v1', label: 'Proxied' }],
    });

    expect(registry.getProviderIds()).toEqual(['openrouter']);
    expect(registry.getProvider('openrouter')).toBeInstanceOf(CustomProvider);
  });

  it('drops custom endpoints on reconfigure, like every other provider', () => {
    // Leaving one behind would keep an endpoint the user had just removed resolvable.
    const registry = new AIProviderRegistry({
      custom: [{ id: 'gateway', baseUrl: 'https://gateway.test/v1' }],
    });

    registry.reconfigure({ openai: { apiKey: 'k' } });

    expect(registry.getProvider('gateway')).toBeUndefined();
    expect(registry.getProviderIds()).toEqual(['openai']);
  });
});

describe('configFromEnv', () => {
  it('reads a custom endpoint from the environment', () => {
    process.env.CUSTOM_PROVIDER_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.CUSTOM_PROVIDER_API_KEY = 'sk-test';
    process.env.CUSTOM_PROVIDER_ID = 'my-gateway';
    process.env.CUSTOM_PROVIDER_LABEL = 'My gateway';
    process.env.CUSTOM_PROVIDER_DEFAULT_MODEL = 'vendor/model';

    expect(AIProviderRegistry.configFromEnv().custom).toEqual([
      {
        id: 'my-gateway',
        label: 'My gateway',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-test',
        defaultModel: 'vendor/model',
      },
    ]);
  });

  it('names the endpoint by default so it is identifiable without configuration', () => {
    process.env.CUSTOM_PROVIDER_BASE_URL = 'https://gateway.test/v1';

    const [entry] = AIProviderRegistry.configFromEnv().custom!;
    expect(entry).toMatchObject({ id: 'custom', label: 'Custom provider' });
  });

  it('reads nothing custom without a base URL, which is what defines it', () => {
    process.env.CUSTOM_PROVIDER_API_KEY = 'sk-test';
    expect(AIProviderRegistry.configFromEnv().custom).toBeUndefined();
  });

  it('activates Ollama on its host alone, since it needs no key', () => {
    process.env.OLLAMA_HOST = 'http://localhost:11434';

    expect(AIProviderRegistry.configFromEnv().ollama).toMatchObject({
      baseUrl: 'http://localhost:11434',
    });
  });

  it('activates Ollama on an explicit opt-in and defaults its host', () => {
    process.env.OLLAMA_ENABLED = 'true';

    expect(AIProviderRegistry.configFromEnv().ollama).toMatchObject({
      baseUrl: 'http://localhost:11434',
    });
  });

  it('leaves a keyed provider out when its key is absent', () => {
    // Registering it anyway would produce a provider that fails on first use rather than
    // one that is visibly not configured.
    const config = AIProviderRegistry.configFromEnv();

    expect(config.openai).toBeUndefined();
    expect(config.anthropic).toBeUndefined();
    expect(config.grok).toBeUndefined();
  });

  it('reads a keyed provider with its base URL override', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or';
    process.env.OPENROUTER_BASE_URL = 'https://proxy.test/v1';
    process.env.OPENROUTER_DEFAULT_MODEL = 'vendor/model';

    expect(AIProviderRegistry.configFromEnv().openrouter).toEqual({
      apiKey: 'sk-or',
      baseUrl: 'https://proxy.test/v1',
      defaultModel: 'vendor/model',
    });
  });
});

describe('aggregated catalogue', () => {
  /** Serves a models payload for the first call and fails for the second. */
  function stubModelsThenFail() {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1;
        if (call === 1) {
          return new Response(
            JSON.stringify({
              data: [{ id: 'vendor/model', name: 'Vendor Model', supported_parameters: ['tools'] }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error('gateway offline');
      }),
    );
  }

  it('tags each model with the provider that serves it', async () => {
    // Two providers can expose the same model id - a gateway relaying OpenAI, for instance -
    // and without the attribution the picker cannot know where to route the request.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ data: [{ id: 'vendor/model' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const registry = new AIProviderRegistry({
      custom: [{ id: 'gateway', label: 'Gateway', baseUrl: 'https://gateway.test/v1' }],
    });

    expect(await registry.listModels()).toEqual([
      {
        id: 'vendor/model',
        displayName: 'vendor/model',
        contextLength: undefined,
        maxOutputTokens: undefined,
        supportsTools: undefined,
        supportsStreaming: true,
        supportsVision: undefined,
        providerId: 'gateway',
        providerName: 'Gateway',
      },
    ]);
  });

  it('keeps the models of a healthy provider when another one is down', async () => {
    // One offline gateway must not empty the whole picker.
    stubModelsThenFail();

    const registry = new AIProviderRegistry({
      custom: [
        { id: 'healthy', baseUrl: 'https://healthy.test/v1' },
        { id: 'offline', baseUrl: 'https://offline.test/v1' },
      ],
    });

    const models = await registry.listModels();

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({ id: 'vendor/model', providerId: 'healthy' });
  });

  it('returns an empty catalogue when nothing is configured', async () => {
    expect(await new AIProviderRegistry({}).listModels()).toEqual([]);
  });
});
