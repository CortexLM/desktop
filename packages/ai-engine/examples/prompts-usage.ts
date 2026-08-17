/**
 * Example usage of the prompt templates library
 * Demonstrates various use cases for long-context scenarios
 */

import {
  PromptComposer,
  QuickPromptBuilder,
  SYSTEM_PROMPTS,
  selectExamples,
  formatExamples,
  estimateTokens,
  summarizeCode,
  selectContext,
  testPromptComposition,
} from '../src/prompts';

// ============================================================================
// Example 1: Simple code generation with Quick Builder
// ============================================================================
async function example1_quickCodeGeneration() {
  console.log('\n=== Example 1: Quick Code Generation ===\n');

  const contextFiles = new Map([
    ['/src/user.ts', `
export interface User {
  id: string;
  name: string;
  email: string;
}

export function getUser(id: string): User {
  // TODO: Implement
  return null as any;
}
    `],
    ['/src/database.ts', `
export async function query(sql: string): Promise<any[]> {
  // Database query implementation
  return [];
}
    `],
  ]);

  const prompt = await QuickPromptBuilder.forCodeGeneration(
    'Implement the getUser function with proper error handling and database integration',
    contextFiles,
    ['/src/user.ts'],
    100000
  );

  console.log(`System prompt preview:\n${prompt.systemPrompt.slice(0, 300)}...\n`);
  console.log(`Total tokens: ${prompt.totalTokens}`);
  console.log(`Sections: ${prompt.sections.map(s => s.name).join(', ')}`);
}

// ============================================================================
// Example 2: Advanced composition with custom configuration
// ============================================================================
async function example2_advancedComposition() {
  console.log('\n=== Example 2: Advanced Composition ===\n');

  const contextFiles = new Map([
    ['/src/api/users.ts', 'export function createUser() {}'],
    ['/src/api/auth.ts', 'export function authenticate() {}'],
    ['/src/types/user.ts', 'export type User = { id: string }'],
  ]);

  const composer = new PromptComposer({
    maxTokens: 128000,
    systemPromptType: 'CODE_GENERATION',
    includeExamples: true,
    includeToolGuidance: true,
    contextFiles,
    focusFiles: ['/src/api/users.ts'],
    systemPromptConfig: {
      contextWindowSize: 128000,
      prioritizeRecent: true,
    },
    toolPromptConfig: {
      enableParallel: true,
      maxParallelCalls: 5,
      includeErrorRecovery: true,
    },
    compressionConfig: {
      targetTokens: 50000,
      preserveStructure: true,
      keepTypes: true,
      summarizationLevel: 'medium',
    },
    customSections: [
      {
        name: 'project_rules',
        content: '# Project Rules\n\n- Use TypeScript strict mode\n- All functions must have JSDoc',
        tokens: 50,
        priority: 2,
        required: true,
      },
    ],
  });

  const prompt = await composer.build('Add input validation to createUser function');

  console.log('Composition stats:');
  console.log(`- Total tokens: ${prompt.totalTokens} / 128000`);
  console.log(`- Utilization: ${(prompt.totalTokens / 128000 * 100).toFixed(1)}%`);
  console.log(`- Sections: ${prompt.sections.length}`);
  
  if (prompt.trimmed.length > 0) {
    console.log(`- Trimmed: ${prompt.trimmed.join(', ')}`);
  }

  console.log('\nSection breakdown:');
  prompt.sections.forEach(s => {
    console.log(`  - ${s.name}: ${s.tokens} tokens (priority: ${s.priority}, required: ${s.required})`);
  });

  // Get token statistics
  const stats = composer.getTokenStats();
  console.log('\nToken stats:', stats);
}

// ============================================================================
// Example 3: Debugging with logs
// ============================================================================
async function example3_debugging() {
  console.log('\n=== Example 3: Debugging with Logs ===\n');

  const logs = `
[2026-08-16 15:23:45.123] INFO: Server started on port 3000
[2026-08-16 15:23:50.456] ERROR: Database connection failed
  at Database.connect (database.ts:45)
  at Server.start (server.ts:23)
  Error: ECONNREFUSED
[2026-08-16 15:23:50.789] WARN: Retrying connection...
[2026-08-16 15:23:51.012] ERROR: Max retries exceeded
  `;

  const prompt = await QuickPromptBuilder.forDebugging(
    'Why is the database connection failing?',
    logs,
    100000
  );

  console.log(`System prompt includes debugging methodology: ${prompt.systemPrompt.includes('Root Cause Analysis')}`);
  console.log(`Total tokens: ${prompt.totalTokens}`);
}

// ============================================================================
// Example 4: Using system prompts directly
// ============================================================================
function example4_systemPrompts() {
  console.log('\n=== Example 4: System Prompts ===\n');

  // Get different system prompts
  const codeGen = SYSTEM_PROMPTS.CODE_GENERATION({ contextWindowSize: 100000 });
  const debugging = SYSTEM_PROMPTS.DEBUGGING({ prioritizeRecent: true });
  const refactoring = SYSTEM_PROMPTS.REFACTORING({ preserveStructure: true });
  const reasoning = SYSTEM_PROMPTS.REASONING();

  console.log('Available system prompts:');
  console.log(`- CODE_GENERATION: ${codeGen.tokens} tokens`);
  console.log(`- DEBUGGING: ${debugging.tokens} tokens`);
  console.log(`- REFACTORING: ${refactoring.tokens} tokens`);
  console.log(`- REASONING: ${reasoning.tokens} tokens`);

  console.log('\nCode generation prompt preview:');
  console.log(codeGen.content.slice(0, 400) + '...');
}

// ============================================================================
// Example 5: Few-shot examples
// ============================================================================
function example5_fewShotExamples() {
  console.log('\n=== Example 5: Few-Shot Examples ===\n');

  // Select examples for different tasks
  const codeExamples = selectExamples('code_generation', 500);
  const debugExamples = selectExamples('debugging', 500);
  const refactorExamples = selectExamples('refactoring', 500);

  console.log(`Code generation examples: ${codeExamples.length}`);
  console.log(`Debugging examples: ${debugExamples.length}`);
  console.log(`Refactoring examples: ${refactorExamples.length}`);

  // Format examples for use in prompt
  const formatted = formatExamples(codeExamples);
  console.log(`\nFormatted examples (${estimateTokens(formatted)} tokens):`);
  console.log(formatted.slice(0, 500) + '...');
}

// ============================================================================
// Example 6: Context compression
// ============================================================================
function example6_contextCompression() {
  console.log('\n=== Example 6: Context Compression ===\n');

  const largeCodeFile = `
import { User } from './types';
import { Database } from './database';

export class UserService {
  constructor(private db: Database) {}

  async createUser(data: Partial<User>): Promise<User> {
    // Validate input
    if (!data.email) {
      throw new Error('Email is required');
    }
    
    // Check for existing user
    const existing = await this.db.query(
      'SELECT * FROM users WHERE email = ?',
      [data.email]
    );
    
    if (existing.length > 0) {
      throw new Error('User already exists');
    }
    
    // Create user
    const result = await this.db.query(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [data.name, data.email]
    );
    
    return {
      id: result.insertId,
      name: data.name!,
      email: data.email,
    };
  }

  async getUser(id: string): Promise<User | null> {
    const results = await this.db.query(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    
    if (results.length === 0) {
      return null;
    }
    
    return results[0];
  }
}
  `.trim();

  console.log(`Original code: ${estimateTokens(largeCodeFile)} tokens\n`);

  // Try different compression levels
  const light = summarizeCode(largeCodeFile, {
    targetTokens: 1000,
    summarizationLevel: 'light',
    preserveStructure: true,
    keepTypes: true,
  });

  const medium = summarizeCode(largeCodeFile, {
    targetTokens: 1000,
    summarizationLevel: 'medium',
    preserveStructure: true,
    keepTypes: true,
  });

  const aggressive = summarizeCode(largeCodeFile, {
    targetTokens: 1000,
    summarizationLevel: 'aggressive',
    preserveStructure: true,
    keepTypes: true,
  });

  console.log(`Light compression: ${light.compressedTokens} tokens (${(light.compressionRatio * 100).toFixed(1)}%)`);
  console.log(`Medium compression: ${medium.compressedTokens} tokens (${(medium.compressionRatio * 100).toFixed(1)}%)`);
  console.log(`Aggressive compression: ${aggressive.compressedTokens} tokens (${(aggressive.compressionRatio * 100).toFixed(1)}%)`);

  console.log('\nMedium compression result:');
  console.log(medium.compressed);
}

// ============================================================================
// Example 7: Context selection for large codebases
// ============================================================================
function example7_contextSelection() {
  console.log('\n=== Example 7: Context Selection ===\n');

  const allFiles = new Map([
    ['/src/api/users.ts', 'export function getUsers() { /* ... */ }'],
    ['/src/api/auth.ts', 'export function authenticate() { /* ... */ }'],
    ['/src/types/user.ts', 'export interface User { id: string; name: string; }'],
    ['/src/types/auth.ts', 'export interface AuthToken { token: string; }'],
    ['/src/utils/validation.ts', 'export function validate() { /* ... */ }'],
    ['/src/utils/crypto.ts', 'export function hash() { /* ... */ }'],
    ['/src/database.ts', 'export class Database { /* ... */ }'],
    ['/src/config.ts', 'export const config = { /* ... */ }'],
  ]);

  const focusFiles = ['/src/api/users.ts'];

  const context = selectContext(
    allFiles,
    focusFiles,
    10000, // Token budget
    {
      targetTokens: 10000,
      preserveStructure: true,
      keepTypes: true,
      summarizationLevel: 'medium',
    }
  );

  console.log('Context window structure:');
  console.log(`- Essential (focus files): ${context.essential.length} files`);
  console.log(`- Relevant (dependencies): ${context.relevant.length} files`);
  console.log(`- Background (others): ${context.background.length} files`);

  console.log('\nEssential context preview:');
  console.log(context.essential[0]?.slice(0, 200) + '...');
}

// ============================================================================
// Example 8: Test composition
// ============================================================================
async function example8_testComposition() {
  console.log('\n=== Example 8: Test Composition ===\n');

  await testPromptComposition({
    maxTokens: 100000,
    systemPromptType: 'REFACTORING',
    includeExamples: true,
    includeToolGuidance: true,
    contextFiles: new Map([
      ['/src/app.ts', 'export function main() {}'],
      ['/src/config.ts', 'export const config = {}'],
    ]),
    focusFiles: ['/src/app.ts'],
  });
}

// ============================================================================
// Run all examples
// ============================================================================
async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Prompt Templates Library - Usage Examples (2026)         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await example1_quickCodeGeneration();
  await example2_advancedComposition();
  await example3_debugging();
  example4_systemPrompts();
  example5_fewShotExamples();
  example6_contextCompression();
  example7_contextSelection();
  await example8_testComposition();

  console.log('\n✅ All examples completed!\n');
}

// Run if executed directly (ES module compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runAllExamples().catch(console.error);
}

export {
  example1_quickCodeGeneration,
  example2_advancedComposition,
  example3_debugging,
  example4_systemPrompts,
  example5_fewShotExamples,
  example6_contextCompression,
  example7_contextSelection,
  example8_testComposition,
  runAllExamples,
};
