/**
 * Bridges AIProviderRegistry to the orchestrator.
 *
 * Registers each provider's infrastructure limits from its known pricing and
 * rate limits, and wraps chat calls into orchestration tasks so callers get
 * infrastructure-aware routing without restructuring their code.
 */

import type { ChatOptions, Message } from '../providers/base';
import type { AIProviderRegistry } from '../registry';
import type { InfraAwareOrchestrator, OrchestrationTask, TaskOutput } from './infra-aware-orchestrator';
import type { ProviderCapacity, ProviderId, SLATargets, TaskPriority } from './types';

/**
 * Default infrastructure profiles per provider. Values reflect typical
 * mid-tier API accounts; override them with `registerProviders` overrides when
 * the deployment has different limits.
 */
export const DEFAULT_PROVIDER_CAPACITIES: Record<string, ProviderCapacity> = {
  openai: {
    maxConcurrency: 8,
    tokensPerMinute: 450_000,
    requestsPerMinute: 500,
    cacheCapacityTokens: 128_000,
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10,
    qualityScore: 0.85,
    baselineLatencyMs: 1_200,
  },
  anthropic: {
    maxConcurrency: 8,
    tokensPerMinute: 400_000,
    requestsPerMinute: 400,
    cacheCapacityTokens: 200_000,
    inputCostPerMillion: 3,
    outputCostPerMillion: 15,
    qualityScore: 0.95,
    baselineLatencyMs: 1_500,
  },
  openrouter: {
    maxConcurrency: 6,
    tokensPerMinute: 300_000,
    requestsPerMinute: 200,
    cacheCapacityTokens: 200_000,
    inputCostPerMillion: 3,
    outputCostPerMillion: 15,
    qualityScore: 0.8,
    baselineLatencyMs: 1_800,
  },
  grok: {
    maxConcurrency: 4,
    tokensPerMinute: 200_000,
    requestsPerMinute: 120,
    inputCostPerMillion: 2,
    outputCostPerMillion: 10,
    qualityScore: 0.75,
    baselineLatencyMs: 2_000,
  },
  // Local inference: no spend and no API rate limit, but low concurrency.
  ollama: {
    maxConcurrency: 2,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    qualityScore: 0.5,
    baselineLatencyMs: 3_000,
  },
};

/**
 * Registers every provider in the registry with the orchestrator's monitor.
 * Unknown provider ids get a conservative default profile.
 */
export function registerProviders(
  orchestrator: InfraAwareOrchestrator,
  registry: AIProviderRegistry,
  overrides: Partial<Record<ProviderId, Partial<ProviderCapacity>>> = {}
): ProviderId[] {
  const registered: ProviderId[] = [];

  for (const providerId of registry.getProviderIds()) {
    const base = DEFAULT_PROVIDER_CAPACITIES[providerId] ?? {
      maxConcurrency: 4,
      qualityScore: 0.5,
      baselineLatencyMs: 2_000,
    };
    orchestrator.registerProvider(providerId, { ...base, ...overrides[providerId] });
    registered.push(providerId);
  }

  return registered;
}

/** Options for building a chat task. */
export interface ChatTaskOptions {
  id: string;
  messages: Message[];
  chatOptions?: ChatOptions;
  priority?: TaskPriority;
  sla?: SLATargets;
  cacheKey?: string;
  restrictTo?: ProviderId[];
  /** Estimated output tokens; defaults to maxTokens or a 1k assumption. */
  estimatedOutputTokens?: number;
}

/**
 * Builds an orchestration task that runs a chat completion against whichever
 * provider the router selects. Real usage is reported back so cost and
 * cache accounting reflect billed tokens rather than estimates.
 */
export function createChatTask(
  registry: AIProviderRegistry,
  options: ChatTaskOptions
): OrchestrationTask<string> {
  const estimatedInputTokens = estimateTokens(options.messages);
  const estimatedOutputTokens =
    options.estimatedOutputTokens ?? options.chatOptions?.maxTokens ?? 1_000;

  return {
    id: options.id,
    estimatedInputTokens,
    estimatedOutputTokens,
    priority: options.priority,
    sla: options.sla,
    cacheKey: options.cacheKey,
    restrictTo: options.restrictTo,
    run: async ({ providerId }): Promise<TaskOutput<string>> => {
      const provider = registry.getProvider(providerId);
      if (!provider) {
        throw new Error(`Provider '${providerId}' not found in registry`);
      }

      const response = await provider.chat(options.messages, options.chatOptions);
      return {
        value: response.content,
        usage: {
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
        },
      };
    },
  };
}

/** Rough token estimate (~4 chars per token) plus per-message overhead. */
function estimateTokens(messages: Message[]): number {
  let total = 0;
  for (const message of messages) {
    total += Math.ceil(message.content.length / 4) + 4;
  }
  return total;
}
