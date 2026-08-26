import { describe, expect, it, vi, afterEach } from 'vitest';

import type { Message, ProviderTool } from '../base';
import { CustomProvider } from '../custom-provider';
import {
  parseToolArguments,
  ToolCallAccumulator,
  type OpenAIToolCallDelta,
} from '../sse';
import { toProviderToolCalls, toWireMessage } from '../openai-compatible-provider';

/**
 * Tool calling across the OpenAI-compatible providers.
 *
 * These are the paths that were declared in the types but never implemented:
 * `ChatOptions.tools` was dropped when building the request, `ChatResponse.toolCalls`
 * was never populated, and `Message` had no way to carry a tool result back. The
 * effect was that every OpenAI-compatible provider silently could not call a tool,
 * while its type signature promised it could.
 */

const LIST_FILES: ProviderTool = {
  name: 'list_files',
  description: 'List files in a directory',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string' } },
    required: ['path'],
  },
};

/** Captures the request a provider actually sends. */
function captureRequest(response: unknown) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];

  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

function provider() {
  return new CustomProvider({
    baseUrl: 'https://gateway.test/v1',
    apiKey: 'test-key',
    defaultModel: 'test-model',
  });
}

const TOOL_CALL_RESPONSE = {
  id: 'c1',
  model: 'test-model',
  choices: [
    {
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'list_files', arguments: '{"path":"/tmp"}' },
          },
        ],
      },
      finish_reason: 'tool_calls',
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sending tools', () => {
  it('puts tools in the request, which it previously dropped', async () => {
    const calls = captureRequest(TOOL_CALL_RESPONSE);
    await provider().chat([{ role: 'user', content: 'hi' }], { tools: [LIST_FILES] });

    expect(calls[0]!.body.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'list_files',
          description: 'List files in a directory',
          parameters: LIST_FILES.parameters,
        },
      },
    ]);
  });

  it('wraps each tool in the function envelope the APIs require', async () => {
    // Sending the tool flat is rejected by OpenAI, OpenRouter, Together and Ollama alike.
    const calls = captureRequest(TOOL_CALL_RESPONSE);
    await provider().chat([{ role: 'user', content: 'hi' }], { tools: [LIST_FILES] });

    const [tool] = calls[0]!.body.tools as Array<{ type: string }>;
    expect(tool!.type).toBe('function');
  });

  it('omits tools entirely when there are none', async () => {
    // An empty `tools: []` makes some providers refuse to answer in prose at all.
    const calls = captureRequest(TOOL_CALL_RESPONSE);
    await provider().chat([{ role: 'user', content: 'hi' }], { tools: [] });

    expect(calls[0]!.body).not.toHaveProperty('tools');
  });

  it('forwards a tool choice only alongside tools', async () => {
    const withTools = captureRequest(TOOL_CALL_RESPONSE);
    await provider().chat([{ role: 'user', content: 'hi' }], {
      tools: [LIST_FILES],
      toolChoice: 'required',
    });
    expect(withTools[0]!.body.tool_choice).toBe('required');

    vi.unstubAllGlobals();
    const withoutTools = captureRequest(TOOL_CALL_RESPONSE);
    await provider().chat([{ role: 'user', content: 'hi' }], { toolChoice: 'required' });
    expect(withoutTools[0]!.body).not.toHaveProperty('tool_choice');
  });

  it('asks for usage on a stream, which providers otherwise omit', async () => {
    const calls = captureRequest(TOOL_CALL_RESPONSE);
    const iterator = provider().stream([{ role: 'user', content: 'hi' }]);
    await iterator.next().catch(() => undefined);

    expect(calls[0]!.body.stream_options).toEqual({ include_usage: true });
  });
});

describe('reading tool calls', () => {
  it('returns the calls the model made, which it previously discarded', async () => {
    captureRequest(TOOL_CALL_RESPONSE);
    const result = await provider().chat([{ role: 'user', content: 'hi' }], {
      tools: [LIST_FILES],
    });

    expect(result.toolCalls).toEqual([
      { id: 'call_1', name: 'list_files', arguments: { path: '/tmp' } },
    ]);
    expect(result.finishReason).toBe('tool_calls');
  });

  it('treats a null content alongside tool calls as empty rather than crashing', async () => {
    // A model that only calls a tool sends `content: null`.
    captureRequest(TOOL_CALL_RESPONSE);
    const result = await provider().chat([{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('');
  });

  it('leaves toolCalls undefined when the model answered in prose', async () => {
    captureRequest({
      id: 'c1',
      model: 'test-model',
      choices: [{ message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    const result = await provider().chat([{ role: 'user', content: 'hi' }]);
    expect(result.toolCalls).toBeUndefined();
    expect(result.content).toBe('Hello');
  });

  it('survives a response with no usage block', async () => {
    // Some gateways omit it entirely; reading it unguarded threw.
    captureRequest({
      id: 'c1',
      model: 'test-model',
      choices: [{ message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
    });

    const result = await provider().chat([{ role: 'user', content: 'hi' }]);
    expect(result.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheReadInputTokens: undefined,
    });
  });

  it('fails loudly on a response with no choices', async () => {
    // Reading choices[0] blindly produced "cannot read property of undefined", which says
    // nothing about what the provider actually returned.
    captureRequest({ id: 'c1', model: 'test-model', choices: [] });

    await expect(provider().chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      /no choices/,
    );
  });
});

describe('parseToolArguments', () => {
  it('decodes the serialised JSON the API sends', () => {
    expect(parseToolArguments('{"path":"/tmp"}')).toEqual({ path: '/tmp' });
  });

  it('returns empty arguments rather than throwing on malformed JSON', () => {
    // A model does occasionally emit invalid JSON. Throwing would fail the whole turn;
    // empty arguments let the loop tell the tool its input was unreadable, which gives the
    // model a chance to correct itself.
    expect(parseToolArguments('{"path": ')).toEqual({});
  });

  it('treats an empty string as no arguments', () => {
    expect(parseToolArguments('')).toEqual({});
    expect(parseToolArguments('   ')).toEqual({});
  });

  it('rejects a non-object payload, which cannot be an argument map', () => {
    expect(parseToolArguments('[1,2]')).toEqual({});
    expect(parseToolArguments('"text"')).toEqual({});
    expect(parseToolArguments('null')).toEqual({});
  });
});

describe('ToolCallAccumulator', () => {
  it('concatenates argument fragments split across chunks', () => {
    // A single call arrives as {"pa / th": "/t / mp"} across several deltas. Parsing each
    // fragment on its own produces invalid JSON every time.
    const accumulator = new ToolCallAccumulator();

    accumulator.add([{ index: 0, id: 'call_1', function: { name: 'list_files', arguments: '{"pa' } }]);
    accumulator.add([{ index: 0, function: { arguments: 'th": "/t' } }]);
    accumulator.add([{ index: 0, function: { arguments: 'mp"}' } }]);

    expect(accumulator.toToolCalls()).toEqual([
      { id: 'call_1', name: 'list_files', arguments: { path: '/tmp' } },
    ]);
  });

  it('keys on index, since id and name only arrive on the first fragment', () => {
    const accumulator = new ToolCallAccumulator();

    accumulator.add([{ index: 0, id: 'a', function: { name: 'first', arguments: '{}' } }]);
    accumulator.add([{ index: 1, id: 'b', function: { name: 'second', arguments: '{}' } }]);
    accumulator.add([{ index: 0, function: { arguments: '' } }]);

    const calls = accumulator.toToolCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ id: 'a', name: 'first' });
    expect(calls[1]).toMatchObject({ id: 'b', name: 'second' });
  });

  it('orders calls by index rather than arrival', () => {
    const accumulator = new ToolCallAccumulator();

    accumulator.add([{ index: 1, id: 'b', function: { name: 'second', arguments: '{}' } }]);
    accumulator.add([{ index: 0, id: 'a', function: { name: 'first', arguments: '{}' } }]);

    expect(accumulator.toToolCalls().map((call) => call.name)).toEqual(['first', 'second']);
  });

  it('synthesises an id when the provider never sends one', () => {
    // The index is stable for the life of the stream, so it makes a usable identifier -
    // and without one the tool result has nothing to pair with.
    const accumulator = new ToolCallAccumulator();
    accumulator.add([{ index: 2, function: { name: 'thing', arguments: '{}' } }]);

    expect(accumulator.toToolCalls()[0]!.id).toBe('call_2');
  });

  it('ignores an absent delta list', () => {
    const accumulator = new ToolCallAccumulator();
    accumulator.add(undefined);
    expect(accumulator.size).toBe(0);
  });

  it('accumulates several calls arriving in one delta', () => {
    const deltas: OpenAIToolCallDelta[] = [
      { index: 0, id: 'a', function: { name: 'one', arguments: '{}' } },
      { index: 1, id: 'b', function: { name: 'two', arguments: '{}' } },
    ];

    const accumulator = new ToolCallAccumulator();
    accumulator.add(deltas);
    expect(accumulator.size).toBe(2);
  });
});

describe('toWireMessage', () => {
  it('pairs a tool result with the call it answers', () => {
    // Without tool_call_id the provider receives a result matching no request and rejects
    // the whole conversation.
    const message: Message = {
      role: 'tool',
      toolCallId: 'call_1',
      name: 'list_files',
      content: '["a","b"]',
    };

    expect(toWireMessage(message)).toEqual({
      role: 'tool',
      content: '["a","b"]',
      tool_call_id: 'call_1',
      name: 'list_files',
    });
  });

  it('sends the assistant turn back with its own tool calls', () => {
    // The loop has to replay them; a tool result on its own is unmatched.
    const message: Message = {
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'call_1', name: 'list_files', arguments: { path: '/tmp' } }],
    };

    expect(toWireMessage(message)).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'list_files', arguments: '{"path":"/tmp"}' },
        },
      ],
    });
  });

  it('nulls the content on a purely tool-calling turn', () => {
    // Some providers refuse an empty string alongside tool_calls.
    const wire = toWireMessage({
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'c', name: 'n', arguments: {} }],
    });

    expect(wire.content).toBeNull();
  });

  it('keeps content when the assistant both spoke and called a tool', () => {
    const wire = toWireMessage({
      role: 'assistant',
      content: 'Let me check.',
      toolCalls: [{ id: 'c', name: 'n', arguments: {} }],
    });

    expect(wire.content).toBe('Let me check.');
  });

  it('leaves a plain message untouched', () => {
    expect(toWireMessage({ role: 'user', content: 'hello' })).toEqual({
      role: 'user',
      content: 'hello',
    });
  });

  it('omits the name on a tool result that has none', () => {
    const wire = toWireMessage({ role: 'tool', toolCallId: 'c', content: 'x' });
    expect(wire).not.toHaveProperty('name');
  });
});

describe('toProviderToolCalls', () => {
  it('returns undefined for an absent or empty list, not an empty array', () => {
    // Callers branch on truthiness; an empty array would read as "the model called tools".
    expect(toProviderToolCalls(undefined)).toBeUndefined();
    expect(toProviderToolCalls([])).toBeUndefined();
  });
});

describe('CustomProvider', () => {
  it('refuses to exist without a base URL, which is what defines it', () => {
    expect(() => new CustomProvider({ baseUrl: '' })).toThrow(/base URL/);
  });

  it('takes its own id so several endpoints can coexist', () => {
    // A fixed id would make a second custom endpoint overwrite the first in the registry.
    const first = new CustomProvider({ baseUrl: 'https://a.test/v1', id: 'gateway-a' });
    const second = new CustomProvider({ baseUrl: 'https://b.test/v1', id: 'gateway-b' });

    expect(first.id).toBe('gateway-a');
    expect(second.id).toBe('gateway-b');
  });

  it('sends the caller-supplied headers a gateway may require', async () => {
    const headers: Array<Record<string, string>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const captured: Record<string, string> = {};
        new Headers(init?.headers).forEach((value, name) => {
          captured[name] = value;
        });
        headers.push(captured);
        return new Response(JSON.stringify(TOOL_CALL_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const custom = new CustomProvider({
      baseUrl: 'https://gateway.test/v1',
      apiKey: 'k',
      headers: { 'X-Org-Id': 'org_42' },
    });
    await custom.chat([{ role: 'user', content: 'hi' }]);

    expect(headers[0]!['x-org-id']).toBe('org_42');
  });

  it('posts to the configured base URL', async () => {
    const calls = captureRequest(TOOL_CALL_RESPONSE);
    await new CustomProvider({ baseUrl: 'https://gateway.test/v1', apiKey: 'k' }).chat([
      { role: 'user', content: 'hi' },
    ]);

    expect(calls[0]!.url).toBe('https://gateway.test/v1/chat/completions');
  });
});

describe('listModels', () => {
  it('reads capabilities from supported_parameters when the provider reports them', async () => {
    // It is the only source that says whether a model accepts tools, and offering a
    // tool-less model for an agent session walks the user into a wall.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'vendor/model',
                name: 'Vendor Model',
                context_length: 128_000,
                top_provider: { max_completion_tokens: 8192 },
                supported_parameters: ['tools', 'temperature'],
                architecture: { input_modalities: ['text', 'image'] },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const models = await provider().listModels();

    expect(models).toEqual([
      {
        id: 'vendor/model',
        displayName: 'Vendor Model',
        contextLength: 128_000,
        maxOutputTokens: 8192,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
      },
    ]);
  });

  it('reports unknown rather than unsupported when a provider says nothing', async () => {
    // `undefined` and `false` are not the same claim, and treating silence as "no tools"
    // would hide every model behind a gateway that does not publish capabilities.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ data: [{ id: 'bare/model' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const [model] = await provider().listModels();

    expect(model!.supportsTools).toBeUndefined();
    expect(model!.displayName).toBe('bare/model');
  });

  it('returns an empty catalogue rather than throwing when the endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    await expect(provider().listModels()).resolves.toEqual([]);
  });

  it('returns an empty catalogue when the endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    await expect(provider().listModels()).resolves.toEqual([]);
  });
});
