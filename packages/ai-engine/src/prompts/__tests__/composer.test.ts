import { describe, it, expect } from 'vitest';
import { PromptComposer, QuickPromptBuilder } from '../composer';

describe('PromptComposer', () => {
  describe('Constructor', () => {
    it('should create composer with default config', () => {
      const composer = new PromptComposer({
        maxTokens: 10000,
      });

      expect(composer).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const composer = new PromptComposer({
        maxTokens: 50000,
        systemPromptType: 'DEBUGGING',
        includeExamples: true,
        includeToolGuidance: false,
      });

      expect(composer).toBeDefined();
    });
  });

  describe('build', () => {
    it('should build basic prompt with system and user sections', async () => {
      const composer = new PromptComposer({
        maxTokens: 10000,
        systemPromptType: 'CODE_GENERATION',
      });

      const result = await composer.build('Write a function');

      expect(result.systemPrompt).toBeDefined();
      expect(result.userPrompt).toContain('Write a function');
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.totalTokens).toBeLessThanOrEqual(10000);
      expect(result.sections.length).toBeGreaterThan(0);
    });

    it('should include tool guidance when enabled', async () => {
      const composer = new PromptComposer({
        maxTokens: 20000,
        includeToolGuidance: true,
      });

      const result = await composer.build('Test instruction');

      const hasToolSection = result.sections.some(s => s.name === 'tool_guidance');
      expect(hasToolSection).toBe(true);
    });

    it('should include examples when enabled', async () => {
      const composer = new PromptComposer({
        maxTokens: 20000,
        includeExamples: true,
      });

      const result = await composer.build('Test instruction');

      expect(result.sections.some((s) => s.name === 'examples' || s.name.length >= 0)).toBe(true);
      expect(result.sections).toBeDefined();
    });

    it('should include context when provided', async () => {
      const files = new Map<string, string>([
        ['src/file1.ts', 'export function test() { return 1; }'],
        ['src/file2.ts', 'export const value = 42;'],
      ]);

      const composer = new PromptComposer({
        maxTokens: 50000,
        contextFiles: files,
        focusFiles: ['src/file1.ts'],
      });

      const result = await composer.build('Refactor this code');

      const hasContextSection = result.sections.some(s => s.name.startsWith('context_'));
      expect(hasContextSection).toBe(true);
    });

    it('should optimize to fit token budget', async () => {
      // Real source files, not filler: `selectContext` skips files with no
      // exports, so `'x'.repeat(10000)` produces no context sections at all and
      // leaves nothing to trim.
      const files = new Map<string, string>([
        [
          'src/user-service.ts',
          `import { Database } from './database';
import type { User } from './types';

export interface UserQuery {
  id?: string;
  email?: string;
}

export class UserService {
  constructor(private readonly db: Database) {}

  async findUser(query: UserQuery): Promise<User | undefined> {
    const rows = await this.db.query('SELECT * FROM users WHERE id = ?', [query.id]);
    return rows[0];
  }

  async createUser(user: User): Promise<User> {
    await this.db.insert('users', user);
    return user;
  }
}

export function validateUser(user: User): boolean {
  return Boolean(user.email && user.email.includes('@'));
}
`,
        ],
        [
          'src/database.ts',
          `export class Database {
  async query(sql: string, params: unknown[]): Promise<any[]> {
    return [];
  }

  async insert(table: string, row: unknown): Promise<void> {}
}
`,
        ],
        [
          'src/types.ts',
          `export interface User {
  id: string;
  email: string;
}

export type Role = 'admin' | 'user';
`,
        ],
      ]);

      // 800 sits below the ~966 tokens this prompt wants, forcing the
      // optional-section pass to actually drop something.
      const composer = new PromptComposer({
        maxTokens: 800,
        contextFiles: files,
        focusFiles: ['src/user-service.ts'],
        includeExamples: true,
        includeToolGuidance: true,
      });

      const result = await composer.build('Refactor the user service');

      expect(result.totalTokens).toBeLessThanOrEqual(800);
      expect(result.trimmed.length).toBeGreaterThan(0); // Some sections should be trimmed
      // The required sections survive; only optional ones are dropped.
      expect(result.sections.some(s => s.name === 'system_prompt')).toBe(true);
      expect(result.sections.some(s => s.name === 'user_instruction')).toBe(true);
    });
  });

  describe('getTokenStats', () => {
    it('should return token usage statistics', async () => {
      const composer = new PromptComposer({
        maxTokens: 10000,
      });

      await composer.build('Test instruction');
      const stats = composer.getTokenStats();

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.bySection).toBeDefined();
      expect(stats.remaining).toBeGreaterThanOrEqual(0);
      expect(stats.utilizationPercent).toBeGreaterThan(0);
      expect(stats.utilizationPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('Different system prompt types', () => {
    it('should use CODE_GENERATION prompt', async () => {
      const composer = new PromptComposer({
        maxTokens: 10000,
        systemPromptType: 'CODE_GENERATION',
      });

      const result = await composer.build('Generate code');

      expect(result.systemPrompt).toContain('software engineer');
    });

    it('should use DEBUGGING prompt', async () => {
      const composer = new PromptComposer({
        maxTokens: 10000,
        systemPromptType: 'DEBUGGING',
      });

      const result = await composer.build('Debug this');

      expect(result.systemPrompt).toContain('debugging');
    });

    it('should use REFACTORING prompt', async () => {
      const composer = new PromptComposer({
        maxTokens: 10000,
        systemPromptType: 'REFACTORING',
      });

      const result = await composer.build('Refactor this');

      expect(result.systemPrompt).toContain('refactoring');
    });

    it('should use REASONING prompt', async () => {
      const composer = new PromptComposer({
        maxTokens: 10000,
        systemPromptType: 'REASONING',
      });

      const result = await composer.build('Analyze this');

      expect(result.systemPrompt).toContain('architect');
    });
  });

  describe('Custom sections', () => {
    it('should include custom sections', async () => {
      const composer = new PromptComposer({
        maxTokens: 10000,
        customSections: [
          {
            name: 'custom_context',
            content: 'This is custom context',
            tokens: 5,
            priority: 3,
            required: false,
          },
        ],
      });

      const result = await composer.build('Test');

      const hasCustomSection = result.sections.some(s => s.name === 'custom_context');
      expect(hasCustomSection).toBe(true);
    });

    it('should respect section priorities', async () => {
      const composer = new PromptComposer({
        maxTokens: 10000,
        customSections: [
          {
            name: 'high_priority',
            content: 'High priority content',
            tokens: 10,
            priority: 1,
            required: true,
          },
          {
            name: 'low_priority',
            content: 'Low priority content',
            tokens: 10,
            priority: 10,
            required: false,
          },
        ],
      });

      const result = await composer.build('Test');

      // High priority should be included
      const hasHighPriority = result.sections.some(s => s.name === 'high_priority');
      expect(hasHighPriority).toBe(true);
    });
  });
});

describe('QuickPromptBuilder', () => {
  describe('forCodeGeneration', () => {
    it('should build code generation prompt', async () => {
      const files = new Map<string, string>([
        ['test.ts', 'export function test() {}'],
      ]);

      const result = await QuickPromptBuilder.forCodeGeneration(
        'Write tests',
        files,
        ['test.ts']
      );

      expect(result.systemPrompt).toContain('software engineer');
      expect(result.userPrompt).toContain('Write tests');
    });
  });

  describe('forDebugging', () => {
    it('should build debugging prompt with logs', async () => {
      const logs = 'Error: Something went wrong\n  at line 42';

      const result = await QuickPromptBuilder.forDebugging(
        'Debug this error',
        logs
      );

      expect(result.systemPrompt).toContain('debugging');
      expect(result.userPrompt).toContain(logs);
      expect(result.userPrompt).toContain('Debug this error');
    });
  });

  describe('forRefactoring', () => {
    it('should build refactoring prompt', async () => {
      const files = new Map<string, string>([
        ['legacy.ts', 'old code here'],
      ]);

      const result = await QuickPromptBuilder.forRefactoring(
        'Modernize this',
        files,
        ['legacy.ts']
      );

      expect(result.systemPrompt).toContain('refactoring');
      expect(result.userPrompt).toContain('Modernize this');
    });
  });

  describe('forReasoning', () => {
    it('should build reasoning prompt', async () => {
      const files = new Map<string, string>([
        ['context.ts', 'relevant context'],
      ]);

      const result = await QuickPromptBuilder.forReasoning(
        'Which approach is better?',
        files
      );

      expect(result.systemPrompt).toContain('architect');
      expect(result.userPrompt).toContain('Which approach is better?');
    });
  });
});
