// Index principal du package ai-engine

// Providers
export * from './providers/base';
export * from './providers/streaming';
export * from './providers/openai-compatible-provider';
export * from './providers/openai-provider';
export * from './providers/anthropic-provider';
export * from './providers/openrouter-provider';
export * from './providers/ollama-provider';
export * from './providers/grok-provider';
export * from './registry';
export * from './model-presets';

// Simple Agent Manager (in-memory sessions)
export * from './simple-agent-manager';

// Coding-agent loop, droids, skills, missions
export * from './agent';

// Token counting and budget management.
// `src/tokens/index.ts` existed but was never re-exported here, so
// `TokenBudgetManager` and the counters were unreachable for consumers
// importing from the package root.
export * from './tokens';

// Context management
export * from './context';

// Context-as-a-Tool: callable, learnable context management (arXiv:2512.22087)
export * from './context-tools';

// Prompt templates and optimization
export * from './prompts';

// Infrastructure-aware orchestration (INFRAMIND pattern)
export * from './orchestration';

// Two-tier model routing (cost optimization)
export * from './routing';

// Composed model selection: preset + task complexity + infrastructure state.
// Preferred entry point over calling routing/, orchestration/ or model-presets
// individually — those three each see only one third of the decision.
export * from './model-selection';
