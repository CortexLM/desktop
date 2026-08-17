/**
 * Prompt Templates Library - Index
 * Optimized for long-context scenarios (100k+ tokens)
 */

// Core exports
export * from './system-prompts';
export * from './examples';
export * from './tool-prompts';
export * from './compression';
export * from './composer';

// Re-export key classes and functions for convenience
export { PromptComposer, QuickPromptBuilder } from './composer';
export type { PromptComposerConfig, ComposedPrompt, PromptSection } from './composer';

export { SYSTEM_PROMPTS } from './system-prompts';
export type { SystemPromptType, SystemPromptConfig, SystemPrompt } from './system-prompts';

export {
  selectExamples,
  formatExamples,
  CODE_GENERATION_EXAMPLES,
  DEBUGGING_EXAMPLES,
  REFACTORING_EXAMPLES,
} from './examples';
export type { Example, ExampleSet } from './examples';

export {
  buildToolUsePrompt,
  TOOL_USE_QUICK_TIPS,
  MCP_TOOL_USE,
  PARALLEL_TOOL_OPTIMIZER,
  TOOL_ERROR_RECOVERY,
} from './tool-prompts';
export type { ToolPromptConfig } from './tool-prompts';

export {
  estimateTokens,
  summarizeCode,
  extractKeyInfo,
  selectContext,
  compressToTarget,
  summarizeFileTree,
} from './compression';
export type { CompressionConfig, CompressionResult, ContextWindow, FileNode } from './compression';
