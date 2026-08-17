import { AIProvider, Message, ChatOptions, ChatResponse, StreamChunk, ProviderConfig } from './base';
import { readStreamLines, tryParseJSON } from './streaming';

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamChunk {
  model: string;
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaProvider extends AIProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options?.model || this.config.defaultModel || 'llama3.1',
          messages: messages as OllamaMessage[],
          options: {
            temperature: options?.temperature,
            num_predict: options?.maxTokens,
            top_p: options?.topP,
            stop: options?.stop,
          },
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = (await response
          .json()
          .catch(() => ({ error: response.statusText }))) as { error?: string };
        throw new Error(error.error || 'Request failed');
      }

      const data: OllamaResponse = await response.json() as OllamaResponse;

      return {
        content: data.message.content,
        model: data.model,
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        finishReason: data.done ? 'stop' : undefined,
      };
    } catch (error) {
      this.handleError(error, 'chat failed');
    }
  }

  async *stream(messages: Message[], options?: ChatOptions): AsyncIterableIterator<StreamChunk> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options?.model || this.config.defaultModel || 'llama3.1',
          messages: messages as OllamaMessage[],
          options: {
            temperature: options?.temperature,
            num_predict: options?.maxTokens,
            top_p: options?.topP,
            stop: options?.stop,
          },
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = (await response
          .json()
          .catch(() => ({ error: response.statusText }))) as { error?: string };
        throw new Error(error.error || 'Request failed');
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Ollama émet du JSON lines (un objet par ligne), pas du SSE
      for await (const line of readStreamLines(response.body)) {
        if (!line.trim()) continue;

        const parsed = tryParseJSON<OllamaStreamChunk>(line);
        if (!parsed) continue;

        yield { content: parsed.message?.content || '', done: parsed.done };

        if (parsed.done) {
          return;
        }
      }
    } catch (error) {
      this.handleError(error, 'stream failed');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
