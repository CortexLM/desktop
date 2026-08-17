import { describe, it, expect } from 'vitest';
import {
  SYSTEM_PROMPTS,
  selectExamples,
  formatExamples,
  estimateTokens,
  summarizeCode,
  extractKeyInfo,
  selectContext,
  PromptComposer,
  QuickPromptBuilder,
} from '../src/prompts';

describe('System Prompts', () => {
  it('should provide all system prompt types', () => {
    expect(SYSTEM_PROMPTS.CODE_GENERATION).toBeDefined();
    expect(SYSTEM_PROMPTS.DEBUGGING).toBeDefined();
    expect(SYSTEM_PROMPTS.REFACTORING).toBeDefined();
    expect(SYSTEM_PROMPTS.REASONING).toBeDefined();
  });

  it('should generate code generation prompt with config', () => {
    const prompt = SYSTEM_PROMPTS.CODE_GENERATION({
      contextWindowSize: 100000,
      prioritizeRecent: true,
    });

    expect(prompt.content).toContain('CONTEXT AWARENESS');
    // The configured size is interpolated verbatim. '100k+' is the fallback used
    // only when no size is supplied, so asserting it here while passing 100000
    // contradicted the call above.
    expect(prompt.content).toContain('100000');
    expect(prompt.tokens).toBeGreaterThan(0);
  });

  it('should fall back to a generic window size when none is configured', () => {
    expect(SYSTEM_PROMPTS.CODE_GENERATION().content).toContain('100k+');
  });

  it('should generate debugging prompt', () => {
    const prompt = SYSTEM_PROMPTS.DEBUGGING();

    expect(prompt.content).toContain('Root Cause Analysis');
    expect(prompt.content).toContain('Stack traces');
    expect(prompt.tokens).toBeGreaterThan(0);
  });
});

describe('Examples', () => {
  it('should select examples within token budget', () => {
    const examples = selectExamples('code_generation', 200);

    const totalTokens = examples.reduce((sum, ex) => sum + ex.tokens, 0);
    expect(totalTokens).toBeLessThanOrEqual(200);
  });

  it('should format examples correctly', () => {
    const examples = selectExamples('code_generation', 500);
    const formatted = formatExamples(examples);

    expect(formatted).toContain('Few-Shot Examples');
    expect(formatted).toContain('Input:');
    expect(formatted).toContain('Expected Output:');
  });

  it('should return empty string for no examples', () => {
    const formatted = formatExamples([]);
    expect(formatted).toBe('');
  });
});

describe('Token Estimation', () => {
  it('should estimate tokens correctly', () => {
    const text = 'a'.repeat(400); // ~100 tokens
    const tokens = estimateTokens(text);

    expect(tokens).toBeGreaterThan(90);
    expect(tokens).toBeLessThan(110);
  });

  it('should handle empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('Code Compression', () => {
  const sampleCode = `
import { User } from './types';

export class UserService {
  async getUser(id: string): Promise<User> {
    const result = await this.db.query('SELECT * FROM users WHERE id = ?', [id]);
    return result[0];
  }

  async createUser(data: User): Promise<User> {
    const result = await this.db.query('INSERT INTO users VALUES (?, ?)', [data.name, data.email]);
    return result;
  }
}
  `.trim();

  it('should compress code with light level', () => {
    const result = summarizeCode(sampleCode, {
      targetTokens: 1000,
      summarizationLevel: 'light',
      preserveStructure: true,
      keepTypes: true,
    });

    expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    expect(result.compressionRatio).toBeLessThan(1);
  });

  it('should compress code with medium level', () => {
    const result = summarizeCode(sampleCode, {
      targetTokens: 1000,
      summarizationLevel: 'medium',
      preserveStructure: true,
      keepTypes: true,
    });

    expect(result.compressed).toContain('import');
    expect(result.compressed).toContain('class');
    expect(result.compressionRatio).toBeLessThan(0.6);
  });

  it('should compress code with aggressive level', () => {
    const result = summarizeCode(sampleCode, {
      targetTokens: 1000,
      summarizationLevel: 'aggressive',
      preserveStructure: true,
      keepTypes: true,
    });

    expect(result.compressionRatio).toBeLessThan(0.5);
  });

  it('should extract key info from code', () => {
    const keyInfo = extractKeyInfo(sampleCode);

    expect(keyInfo.imports.length).toBeGreaterThan(0);
    expect(keyInfo.classes.length).toBeGreaterThan(0);
    expect(keyInfo.imports[0]).toContain('import');
  });
});

describe('Context Selection', () => {
  const allFiles = new Map([
    ['/src/user.ts', 'export function getUser() {}'],
    ['/src/auth.ts', 'export function authenticate() {}'],
    ['/src/types.ts', 'export interface User {}'],
  ]);

  it('should select context with focus files', () => {
    const context = selectContext(
      allFiles,
      ['/src/user.ts'],
      10000,
      {
        targetTokens: 10000,
        summarizationLevel: 'medium',
        preserveStructure: true,
        keepTypes: true,
      }
    );

    expect(context.essential.length).toBeGreaterThan(0);
    expect(context.essential[0]).toContain('/src/user.ts');
  });

  it('should organize context by priority', () => {
    const context = selectContext(
      allFiles,
      ['/src/user.ts'],
      10000,
      {
        targetTokens: 10000,
        summarizationLevel: 'medium',
        preserveStructure: true,
        keepTypes: true,
      }
    );

    expect(context.essential).toBeDefined();
    expect(context.relevant).toBeDefined();
    expect(context.background).toBeDefined();
  });
});

describe('PromptComposer', () => {
  it('should build a basic prompt', async () => {
    const composer = new PromptComposer({
      maxTokens: 10000,
      systemPromptType: 'CODE_GENERATION',
      includeExamples: false,
      includeToolGuidance: false,
    });

    const prompt = await composer.build('Test instruction');

    expect(prompt.systemPrompt).toContain('CONTEXT AWARENESS');
    expect(prompt.userPrompt).toContain('Test instruction');
    expect(prompt.totalTokens).toBeGreaterThan(0);
    expect(prompt.totalTokens).toBeLessThanOrEqual(10000);
  });

  it('should include examples when enabled', async () => {
    const composer = new PromptComposer({
      maxTokens: 50000,
      systemPromptType: 'CODE_GENERATION',
      includeExamples: true,
      includeToolGuidance: false,
    });

    const prompt = await composer.build('Test instruction');
    const hasExamples = prompt.sections.some(s => s.name === 'examples');

    expect(hasExamples).toBe(true);
  });

  it('should include tool guidance when enabled', async () => {
    const composer = new PromptComposer({
      maxTokens: 50000,
      systemPromptType: 'CODE_GENERATION',
      includeExamples: false,
      includeToolGuidance: true,
    });

    const prompt = await composer.build('Test instruction');
    const hasToolGuidance = prompt.sections.some(s => s.name === 'tool_guidance');

    expect(hasToolGuidance).toBe(true);
  });

  it('should trim optional sections when over budget', async () => {
    const composer = new PromptComposer({
      maxTokens: 500, // Very small budget
      systemPromptType: 'CODE_GENERATION',
      includeExamples: true,
      includeToolGuidance: true,
    });

    const prompt = await composer.build('Test instruction');

    expect(prompt.totalTokens).toBeLessThanOrEqual(500);
    expect(prompt.trimmed.length).toBeGreaterThan(0);
  });

  it('should handle context files', async () => {
    const contextFiles = new Map([
      ['/src/test.ts', 'export function test() { return "hello"; }'],
    ]);

    const composer = new PromptComposer({
      maxTokens: 50000,
      systemPromptType: 'CODE_GENERATION',
      contextFiles,
      focusFiles: ['/src/test.ts'],
    });

    const prompt = await composer.build('Test instruction');
    const hasContext = prompt.sections.some(s => s.name.startsWith('context_'));

    expect(hasContext).toBe(true);
  });

  it('should get token stats', async () => {
    const composer = new PromptComposer({
      maxTokens: 10000,
      systemPromptType: 'CODE_GENERATION',
    });

    await composer.build('Test instruction');
    const stats = composer.getTokenStats();

    expect(stats.total).toBeGreaterThan(0);
    expect(stats.remaining).toBeGreaterThanOrEqual(0);
    expect(stats.utilizationPercent).toBeGreaterThan(0);
    expect(stats.bySection).toBeDefined();
  });
});

describe('QuickPromptBuilder', () => {
  it('should build code generation prompt', async () => {
    const contextFiles = new Map([
      ['/src/test.ts', 'export function test() {}'],
    ]);

    const prompt = await QuickPromptBuilder.forCodeGeneration(
      'Add error handling',
      contextFiles,
      ['/src/test.ts'],
      100000
    );

    expect(prompt.systemPrompt).toContain('CODE GENERATION');
    expect(prompt.totalTokens).toBeGreaterThan(0);
  });

  it('should build debugging prompt', async () => {
    const logs = 'Error: Something failed\n  at test.ts:45';

    const prompt = await QuickPromptBuilder.forDebugging(
      'Why did this fail?',
      logs,
      100000
    );

    expect(prompt.systemPrompt).toContain('Root Cause');
    expect(prompt.userPrompt).toContain('Error: Something failed');
  });

  it('should build refactoring prompt', async () => {
    const contextFiles = new Map([
      ['/src/test.ts', 'export function test() {}'],
    ]);

    const prompt = await QuickPromptBuilder.forRefactoring(
      'Extract utility functions',
      contextFiles,
      ['/src/test.ts'],
      150000
    );

    expect(prompt.systemPrompt).toContain('REFACTORING');
    expect(prompt.totalTokens).toBeGreaterThan(0);
  });

  it('should build reasoning prompt', async () => {
    const contextFiles = new Map([
      ['/src/test.ts', 'export function test() {}'],
    ]);

    const prompt = await QuickPromptBuilder.forReasoning(
      'Should we use Redis or in-memory cache?',
      contextFiles,
      120000
    );

    expect(prompt.systemPrompt).toContain('REASONING');
    expect(prompt.totalTokens).toBeGreaterThan(0);
  });
});
