/**
 * Shared environment checks for the E2E suite.
 */

/**
 * Whether an AI provider is configured.
 *
 * Chat sessions cannot be created without one: AIService.createSession() throws
 * "No default AI provider configured" and then checks provider.isAvailable(), so
 * ChatView (and its message input) never mounts. Specs that need a live
 * conversation gate on this and skip — rather than weaken their assertions —
 * when no key is present.
 */
export const HAS_AI_PROVIDER = Boolean(
  process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OLLAMA_HOST ||
    process.env.OLLAMA_ENABLED
);

export const AI_PROVIDER_SKIP_REASON =
  'Needs a configured AI provider (OPENAI_API_KEY / ANTHROPIC_API_KEY / OPENROUTER_API_KEY / OLLAMA_HOST) to create a chat session.';
