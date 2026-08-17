/**
 * Bridge between `ModelRouter` and the existing provider registry.
 *
 * Without this, callers have to hand-roll the map from routing decisions to
 * provider calls, and from provider errors to failure kinds. Getting the second
 * part wrong is expensive: misreading a rate limit as a capability failure
 * escalates a task to the top lane for no reason.
 */

import { HeuristicTokenCounter } from '../tokens/token-counter';
import type { AIProviderRegistry } from '../registry';
import { AIProviderError } from '../providers/base';
import type { ChatResponse, Message } from '../providers/base';
import type { AttemptResult, RoutedResult } from './model-router';
import type { ModelRouter } from './model-router';
import type { FailureKind, ModelChoice, Task } from './types';

const counter = new HeuristicTokenCounter();

/**
 * Classify a thrown provider error into a routing failure kind.
 *
 * Rate limits and 5xx are infrastructure noise: retry the same lane. Auth and
 * config problems are fatal. Context-length rejections mean the lane's window
 * is too small, which is the one error class where a *different* lane genuinely
 * helps.
 */
export function classifyProviderError(error: unknown): FailureKind {
  const status =
    error instanceof AIProviderError
      ? error.statusCode
      : ((error as { status?: number; statusCode?: number })?.status ??
        (error as { statusCode?: number })?.statusCode);

  const message = (error as { message?: string })?.message?.toLowerCase() ?? '';

  if (/context length|too many tokens|maximum context|prompt is too long/.test(message)) {
    return 'context-overflow';
  }

  if (status === 429 || (typeof status === 'number' && status >= 500)) {
    return 'transient';
  }

  if (status === 401 || status === 403 || status === 404) {
    return 'provider-error';
  }

  if (/timeout|econnreset|enotfound|socket hang up|network/.test(message)) {
    return 'transient';
  }

  return 'provider-error';
}

export interface RoutedChatOptions {
  temperature?: number;
  maxTokens?: number;
  /**
   * Accept or reject a response. Rejecting escalates. Defaults to accepting any
   * non-empty response.
   */
  validate?: (response: ChatResponse, choice: ModelChoice) => boolean | { ok: boolean; failureKind?: FailureKind };
}

/**
 * Run a chat completion through the router, escalating lanes on failure.
 *
 * The provider named by the routing decision must be registered; if it is not,
 * the attempt is reported as a provider error so the router stops rather than
 * burning the remaining lanes on a configuration mistake.
 */
export async function routedChat(
  router: ModelRouter,
  registry: AIProviderRegistry,
  task: Task,
  messages: Message[],
  options: RoutedChatOptions = {}
): Promise<RoutedResult<ChatResponse>> {
  const validate = options.validate ?? ((response: ChatResponse) => response.content.trim().length > 0);
  // Charged even when a call fails, so it must be attributed rather than dropped.
  const estimatedInput = counter.estimateMessageTokens(messages);

  return router.execute<ChatResponse>(task, async (choice): Promise<AttemptResult<ChatResponse>> => {
    const provider = registry.getProvider(choice.provider);
    if (!provider) {
      return {
        success: false,
        usage: { inputTokens: 0, outputTokens: 0 },
        failureKind: 'provider-error',
        message: `provider '${choice.provider}' is not registered`,
      };
    }

    try {
      const response = await provider.chat(messages, {
        model: choice.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });

      const usage = {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      };

      const verdict = validate(response, choice);
      const ok = typeof verdict === 'boolean' ? verdict : verdict.ok;
      if (ok) {
        return { success: true, value: response, usage };
      }

      return {
        success: false,
        usage,
        failureKind: typeof verdict === 'boolean' ? 'validation-failed' : (verdict.failureKind ?? 'validation-failed'),
      };
    } catch (error) {
      return {
        success: false,
        // Input tokens were sent and are likely billed; output is unknown.
        usage: { inputTokens: estimatedInput, outputTokens: 0 },
        failureKind: classifyProviderError(error),
        message: (error as { message?: string })?.message,
      };
    }
  });
}
