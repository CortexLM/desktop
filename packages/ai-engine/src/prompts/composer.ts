/**
 * Prompt Composer - Builds optimal prompts with token budget awareness
 * Intelligently combines system prompts, examples, context, and instructions
 */

import {
  SYSTEM_PROMPTS,
  SystemPromptType,
  SystemPromptConfig,
} from './system-prompts';
import { selectExamples, formatExamples } from './examples';
import { buildToolUsePrompt, ToolPromptConfig, TOOL_USE_QUICK_TIPS } from './tool-prompts';
import {
  estimateTokens,
  selectContext,
  compressToTarget,
  CompressionConfig,
} from './compression';

export interface PromptSection {
  name: string;
  content: string;
  tokens: number;
  priority: number; // 1 = highest, lower numbers = higher priority
  required: boolean;
}

export interface PromptComposerConfig {
  maxTokens: number;
  systemPromptType?: SystemPromptType;
  includeExamples?: boolean;
  includeToolGuidance?: boolean;
  contextFiles?: Map<string, string>;
  focusFiles?: string[];
  compressionConfig?: CompressionConfig;
  systemPromptConfig?: SystemPromptConfig;
  toolPromptConfig?: ToolPromptConfig;
  customSections?: PromptSection[];
}

export interface ComposedPrompt {
  systemPrompt: string;
  userPrompt: string;
  totalTokens: number;
  sections: PromptSection[];
  trimmed: string[]; // Names of sections that were trimmed or removed
}

/**
 * Main Prompt Composer class
 */
export class PromptComposer {
  private config: Required<PromptComposerConfig>;
  private sections: PromptSection[] = [];

  constructor(config: PromptComposerConfig) {
    this.config = {
      maxTokens: config.maxTokens,
      systemPromptType: config.systemPromptType || 'CODE_GENERATION',
      includeExamples: config.includeExamples ?? false,
      includeToolGuidance: config.includeToolGuidance ?? true,
      contextFiles: config.contextFiles || new Map(),
      focusFiles: config.focusFiles || [],
      compressionConfig: config.compressionConfig || {
        targetTokens: 10000,
        preserveStructure: true,
        keepTypes: true,
        summarizationLevel: 'medium',
      },
      systemPromptConfig: config.systemPromptConfig || {},
      toolPromptConfig: config.toolPromptConfig || {
        enableParallel: true,
        maxParallelCalls: 5,
        includeErrorRecovery: true,
      },
      customSections: config.customSections || [],
    };
  }

  /**
   * Build the complete prompt
   */
  async build(userInstruction: string): Promise<ComposedPrompt> {
    this.sections = [];

    // 1. System prompt (required, highest priority)
    this.addSystemPrompt();

    // 2. Tool guidance (high priority if enabled)
    if (this.config.includeToolGuidance) {
      this.addToolGuidance();
    }

    // 3. Examples (medium priority if enabled)
    if (this.config.includeExamples) {
      this.addExamples();
    }

    // 4. Context from files (variable priority based on relevance)
    if (this.config.contextFiles.size > 0) {
      this.addContext();
    }

    // 5. Custom sections
    this.sections.push(...this.config.customSections);

    // 6. User instruction (required, highest priority)
    this.addUserInstruction(userInstruction);

    // Sort by priority
    this.sections.sort((a, b) => a.priority - b.priority);

    // Optimize to fit token budget
    const optimized = this.optimizeToFitBudget();

    return optimized;
  }

  /**
   * Add system prompt section
   */
  private addSystemPrompt(): void {
    const promptFn = SYSTEM_PROMPTS[this.config.systemPromptType];
    const prompt = promptFn(this.config.systemPromptConfig);

    this.sections.push({
      name: 'system_prompt',
      content: prompt.content,
      tokens: prompt.tokens,
      priority: 1,
      required: true,
    });
  }

  /**
   * Add tool guidance section
   */
  private addToolGuidance(): void {
    const toolPrompt = buildToolUsePrompt(this.config.toolPromptConfig);
    const tokens = estimateTokens(toolPrompt);

    // Use quick tips if full guidance is too large
    const content = tokens > 1000 ? TOOL_USE_QUICK_TIPS : toolPrompt;

    this.sections.push({
      name: 'tool_guidance',
      content,
      tokens: estimateTokens(content),
      priority: 2,
      required: false,
    });
  }

  /**
   * Add few-shot examples section
   */
  private addExamples(): void {
    const taskTypeMap: Record<SystemPromptType, 'code_generation' | 'debugging' | 'refactoring'> = {
      CODE_GENERATION: 'code_generation',
      DEBUGGING: 'debugging',
      REFACTORING: 'refactoring',
      REASONING: 'code_generation', // Default to code_generation for reasoning
    };

    const taskType = taskTypeMap[this.config.systemPromptType];
    const examples = selectExamples(taskType, 500); // Max 500 tokens for examples

    if (examples.length > 0) {
      const formatted = formatExamples(examples);
      this.sections.push({
        name: 'examples',
        content: formatted,
        tokens: estimateTokens(formatted),
        priority: 3,
        required: false,
      });
    }
  }

  /**
   * Add code context section with intelligent compression
   */
  private addContext(): void {
    const contextBudget = Math.floor(this.config.maxTokens * 0.6); // Up to 60% for context

    const contextWindow = selectContext(
      this.config.contextFiles,
      this.config.focusFiles,
      contextBudget,
      this.config.compressionConfig
    );

    // Essential context (focus files)
    if (contextWindow.essential.length > 0) {
      const essentialContent = contextWindow.essential.join('\n\n---\n\n');
      this.sections.push({
        name: 'context_essential',
        content: `# Primary Context (Focus Files)\n\n${essentialContent}`,
        tokens: estimateTokens(essentialContent),
        priority: 2,
        required: true,
      });
    }

    // Relevant context (dependencies)
    if (contextWindow.relevant.length > 0) {
      const relevantContent = contextWindow.relevant.join('\n\n');
      this.sections.push({
        name: 'context_relevant',
        content: `# Related Files (Dependencies)\n\n${relevantContent}`,
        tokens: estimateTokens(relevantContent),
        priority: 4,
        required: false,
      });
    }

    // Background context (file listing)
    if (contextWindow.background.length > 0) {
      const backgroundContent = contextWindow.background.join('\n');
      this.sections.push({
        name: 'context_background',
        content: `# Additional Context (Available Files)\n\n${backgroundContent}`,
        tokens: estimateTokens(backgroundContent),
        priority: 5,
        required: false,
      });
    }
  }

  /**
   * Add user instruction section
   */
  private addUserInstruction(instruction: string): void {
    this.sections.push({
      name: 'user_instruction',
      content: instruction,
      tokens: estimateTokens(instruction),
      priority: 1,
      required: true,
    });
  }

  /**
   * Optimize sections to fit within token budget
   */
  private optimizeToFitBudget(): ComposedPrompt {
    let totalTokens = this.sections.reduce((sum, s) => sum + s.tokens, 0);
    const trimmed: string[] = [];

    // If within budget, return as-is
    if (totalTokens <= this.config.maxTokens) {
      return this.assemblePrompt(this.sections, trimmed);
    }

    // Strategy 1: Remove optional sections from lowest priority first
    const optimized = [...this.sections];
    const optional = optimized.filter(s => !s.required).sort((a, b) => b.priority - a.priority);

    for (const section of optional) {
      if (totalTokens <= this.config.maxTokens) break;

      const index = optimized.indexOf(section);
      optimized.splice(index, 1);
      totalTokens -= section.tokens;
      trimmed.push(section.name);
    }

    // If still over budget, compress context sections
    if (totalTokens > this.config.maxTokens) {
      const contextSections = optimized.filter(s => s.name.startsWith('context_'));
      
      for (const section of contextSections) {
        if (totalTokens <= this.config.maxTokens) break;

        const targetTokens = Math.floor(section.tokens * 0.5); // Compress by 50%
        const compressed = compressToTarget(section.content, targetTokens, {
          preserveStructure: true,
          keepTypes: true,
          summarizationLevel: 'aggressive',
        });

        section.content = compressed.compressed;
        const savedTokens = section.tokens - compressed.compressedTokens;
        section.tokens = compressed.compressedTokens;
        totalTokens -= savedTokens;
        
        if (!trimmed.includes(section.name)) {
          trimmed.push(`${section.name} (compressed)`);
        }
      }
    }

    // Last resort: truncate system prompt or user instruction
    if (totalTokens > this.config.maxTokens) {
      const excess = totalTokens - this.config.maxTokens;
      console.warn(`⚠️ Prompt still exceeds budget by ${excess} tokens after optimization`);
    }

    return this.assemblePrompt(optimized, trimmed);
  }

  /**
   * Assemble final prompt from sections
   */
  private assemblePrompt(sections: PromptSection[], trimmed: string[]): ComposedPrompt {
    // Sections that instruct the model belong in the system role.
    const SYSTEM_SECTIONS = new Set(['system_prompt', 'tool_guidance', 'examples']);

    const systemSections = sections.filter(s => SYSTEM_SECTIONS.has(s.name));

    // Everything else is task payload and goes to the user role. Matching
    // user sections by name meant custom sections were counted in
    // `totalTokens` but silently dropped from both prompts -- so
    // `QuickPromptBuilder.forDebugging` charged for the logs and then never
    // sent them.
    const userSections = sections.filter(s => !SYSTEM_SECTIONS.has(s.name));

    const systemPrompt = systemSections
      .map(s => s.content)
      .join('\n\n---\n\n');

    const userPrompt = userSections
      .map(s => s.content)
      .join('\n\n---\n\n');

    const totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);

    return {
      systemPrompt,
      userPrompt,
      totalTokens,
      sections,
      trimmed,
    };
  }

  /**
   * Get current token usage statistics
   */
  getTokenStats(): {
    total: number;
    bySection: Record<string, number>;
    remaining: number;
    utilizationPercent: number;
  } {
    const bySection: Record<string, number> = {};
    let total = 0;

    for (const section of this.sections) {
      bySection[section.name] = section.tokens;
      total += section.tokens;
    }

    return {
      total,
      bySection,
      remaining: Math.max(0, this.config.maxTokens - total),
      utilizationPercent: (total / this.config.maxTokens) * 100,
    };
  }
}

/**
 * Quick builder for common scenarios
 */
export class QuickPromptBuilder {
  /**
   * Build a code generation prompt
   */
  static forCodeGeneration(
    instruction: string,
    contextFiles: Map<string, string>,
    focusFiles: string[],
    maxTokens: number = 100000
  ): Promise<ComposedPrompt> {
    const composer = new PromptComposer({
      maxTokens,
      systemPromptType: 'CODE_GENERATION',
      includeExamples: true,
      includeToolGuidance: true,
      contextFiles,
      focusFiles,
    });

    return composer.build(instruction);
  }

  /**
   * Build a debugging prompt
   */
  static forDebugging(
    instruction: string,
    logs: string,
    maxTokens: number = 100000
  ): Promise<ComposedPrompt> {
    const composer = new PromptComposer({
      maxTokens,
      systemPromptType: 'DEBUGGING',
      includeExamples: true,
      includeToolGuidance: false,
      customSections: [
        {
          name: 'debug_logs',
          content: `# Execution Logs and Traces\n\n\`\`\`\n${logs}\n\`\`\``,
          tokens: estimateTokens(logs),
          priority: 2,
          required: true,
        },
      ],
    });

    return composer.build(instruction);
  }

  /**
   * Build a refactoring prompt
   */
  static forRefactoring(
    instruction: string,
    contextFiles: Map<string, string>,
    focusFiles: string[],
    maxTokens: number = 150000
  ): Promise<ComposedPrompt> {
    const composer = new PromptComposer({
      maxTokens,
      systemPromptType: 'REFACTORING',
      includeExamples: true,
      includeToolGuidance: true,
      contextFiles,
      focusFiles,
      compressionConfig: {
        targetTokens: 50000,
        preserveStructure: true,
        keepTypes: true,
        summarizationLevel: 'light', // Less aggressive for refactoring
      },
    });

    return composer.build(instruction);
  }

  /**
   * Build a reasoning/planning prompt
   */
  static forReasoning(
    instruction: string,
    contextFiles: Map<string, string>,
    maxTokens: number = 120000
  ): Promise<ComposedPrompt> {
    const composer = new PromptComposer({
      maxTokens,
      systemPromptType: 'REASONING',
      includeExamples: false, // Reasoning doesn't need code examples
      includeToolGuidance: false,
      contextFiles,
      focusFiles: [], // All files are background context
    });

    return composer.build(instruction);
  }
}

/**
 * Utility to test prompt composition
 */
export async function testPromptComposition(config: PromptComposerConfig): Promise<void> {
  const composer = new PromptComposer(config);
  const result = await composer.build('Test instruction');

  console.log('=== Prompt Composition Test ===');
  console.log(`Total tokens: ${result.totalTokens} / ${config.maxTokens}`);
  console.log(`Utilization: ${((result.totalTokens / config.maxTokens) * 100).toFixed(1)}%`);
  console.log('\nSections included:');
  
  for (const section of result.sections) {
    console.log(`  - ${section.name}: ${section.tokens} tokens (priority: ${section.priority})`);
  }

  if (result.trimmed.length > 0) {
    console.log('\nSections trimmed/removed:');
    result.trimmed.forEach(name => console.log(`  - ${name}`));
  }

  console.log('\n=== System Prompt Preview ===');
  console.log(result.systemPrompt.slice(0, 500) + '...\n');

  console.log('=== User Prompt Preview ===');
  console.log(result.userPrompt.slice(0, 500) + '...\n');
}
