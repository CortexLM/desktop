import { describe, it, expect } from 'vitest';
import {
  CODE_GENERATION_LONG_CONTEXT,
  DEBUGGING_LONG_CONTEXT,
  REFACTORING_LONG_CONTEXT,
  REASONING_LONG_CONTEXT,
  SYSTEM_PROMPTS,
  type SystemPromptConfig,
} from '../system-prompts';

describe('System Prompts', () => {
  describe('CODE_GENERATION_LONG_CONTEXT', () => {
    it('should generate code generation prompt with default config', () => {
      const prompt = CODE_GENERATION_LONG_CONTEXT();
      
      expect(prompt.content).toContain('expert software engineer');
      expect(prompt.content).toContain('CONTEXT AWARENESS');
      expect(prompt.content).toContain('CODE GENERATION PRINCIPLES');
      expect(prompt.content).toContain('100k+');
      expect(prompt.tokens).toBe(320);
      expect(prompt.config).toEqual({});
    });

    it('should use custom context window size', () => {
      const prompt = CODE_GENERATION_LONG_CONTEXT({ contextWindowSize: 200000 });
      
      expect(prompt.content).toContain('200000');
      expect(prompt.config.contextWindowSize).toBe(200000);
    });

    it('should include all required sections', () => {
      const prompt = CODE_GENERATION_LONG_CONTEXT();
      
      expect(prompt.content).toContain('CONTEXT AWARENESS');
      expect(prompt.content).toContain('CODE GENERATION PRINCIPLES');
      expect(prompt.content).toContain('OUTPUT FORMAT');
      expect(prompt.content).toContain('CONTEXT UTILIZATION STRATEGY');
      expect(prompt.content).toContain('EFFICIENCY');
    });

    it('should emphasize consistency and type safety', () => {
      const prompt = CODE_GENERATION_LONG_CONTEXT();
      
      expect(prompt.content).toContain('Consistency First');
      expect(prompt.content).toContain('Type Safety');
      expect(prompt.content).toContain('TypeScript');
    });
  });

  describe('DEBUGGING_LONG_CONTEXT', () => {
    it('should generate debugging prompt with default config', () => {
      const prompt = DEBUGGING_LONG_CONTEXT();
      
      expect(prompt.content).toContain('debugging specialist');
      expect(prompt.content).toContain('DEBUGGING METHODOLOGY');
      expect(prompt.content).toContain('Root Cause');
      expect(prompt.tokens).toBe(340);
    });

    it('should include structured analysis format', () => {
      const prompt = DEBUGGING_LONG_CONTEXT();
      
      expect(prompt.content).toContain('## Root Cause');
      expect(prompt.content).toContain('## Evidence');
      expect(prompt.content).toContain('## Fix');
      expect(prompt.content).toContain('## Prevention');
    });

    it('should emphasize chronological order', () => {
      const prompt = DEBUGGING_LONG_CONTEXT();
      
      expect(prompt.content).toContain('chronological order');
      expect(prompt.content).toContain('HIGHEST PRIORITY');
      expect(prompt.content).toContain('timestamp');
    });
  });

  describe('REFACTORING_LONG_CONTEXT', () => {
    it('should generate refactoring prompt with default config', () => {
      const prompt = REFACTORING_LONG_CONTEXT();
      
      expect(prompt.content).toContain('large-scale codebase refactoring');
      expect(prompt.content).toContain('REFACTORING PRINCIPLES');
      expect(prompt.content).toContain('Phase 1: Preparation');
      expect(prompt.tokens).toBe(380);
    });

    it('should include phased approach', () => {
      const prompt = REFACTORING_LONG_CONTEXT();
      
      expect(prompt.content).toContain('Phase 1: Preparation');
      expect(prompt.content).toContain('Phase 2: Migration');
      expect(prompt.content).toContain('Phase 3: Cleanup');
    });

    it('should emphasize safety and backward compatibility', () => {
      const prompt = REFACTORING_LONG_CONTEXT();
      
      expect(prompt.content).toContain('Incremental Safety');
      expect(prompt.content).toContain('Backward Compatibility');
      expect(prompt.content).toContain('Test Preservation');
    });

    it('should include risk management', () => {
      const prompt = REFACTORING_LONG_CONTEXT();
      
      expect(prompt.content).toContain('RISK MANAGEMENT');
      expect(prompt.content).toContain('high-risk changes');
      expect(prompt.content).toContain('rollback strategies');
    });
  });

  describe('REASONING_LONG_CONTEXT', () => {
    it('should generate reasoning prompt with default config', () => {
      const prompt = REASONING_LONG_CONTEXT();
      
      expect(prompt.content).toContain('technical architect');
      expect(prompt.content).toContain('REASONING FRAMEWORK');
      expect(prompt.content).toContain('Step 1: Problem Definition');
      expect(prompt.tokens).toBe(420);
    });

    it('should include multi-step reasoning structure', () => {
      const prompt = REASONING_LONG_CONTEXT();
      
      expect(prompt.content).toContain('Step 1: Problem Definition');
      expect(prompt.content).toContain('Step 2: Context Integration');
      expect(prompt.content).toContain('Step 3: Solution Space');
      expect(prompt.content).toContain('Step 4: Trade-off Analysis');
      expect(prompt.content).toContain('Step 5: Recommendation');
    });

    it('should emphasize trade-off analysis', () => {
      const prompt = REASONING_LONG_CONTEXT();
      
      expect(prompt.content).toContain('Trade-off Analysis');
      expect(prompt.content).toContain('Performance vs Simplicity');
      expect(prompt.content).toContain('Development speed vs Maintainability');
    });

    it('should encourage explicit reasoning', () => {
      const prompt = REASONING_LONG_CONTEXT();
      
      expect(prompt.content).toContain('Show your reasoning process');
      expect(prompt.content).toContain('Reference specific context');
      expect(prompt.content).toContain('Acknowledge uncertainty');
    });
  });

  describe('SYSTEM_PROMPTS map', () => {
    it('should contain all prompt types', () => {
      expect(SYSTEM_PROMPTS.CODE_GENERATION).toBeDefined();
      expect(SYSTEM_PROMPTS.DEBUGGING).toBeDefined();
      expect(SYSTEM_PROMPTS.REFACTORING).toBeDefined();
      expect(SYSTEM_PROMPTS.REASONING).toBeDefined();
    });

    it('should return correct prompt functions', () => {
      const codePrompt = SYSTEM_PROMPTS.CODE_GENERATION();
      expect(codePrompt.content).toContain('expert software engineer');
      
      const debugPrompt = SYSTEM_PROMPTS.DEBUGGING();
      expect(debugPrompt.content).toContain('debugging specialist');
      
      const refactorPrompt = SYSTEM_PROMPTS.REFACTORING();
      expect(refactorPrompt.content).toContain('large-scale codebase refactoring');
      
      const reasoningPrompt = SYSTEM_PROMPTS.REASONING();
      expect(reasoningPrompt.content).toContain('technical architect');
    });
  });

  describe('SystemPromptConfig', () => {
    it('should accept all config options', () => {
      const config: SystemPromptConfig = {
        contextWindowSize: 150000,
        prioritizeRecent: true,
        includeMetadata: true,
        compressionLevel: 'light',
      };

      const prompt = CODE_GENERATION_LONG_CONTEXT(config);
      
      expect(prompt.config).toEqual(config);
    });

    it('should work with partial config', () => {
      const config: SystemPromptConfig = {
        contextWindowSize: 100000,
      };

      const prompt = DEBUGGING_LONG_CONTEXT(config);
      
      expect(prompt.config.contextWindowSize).toBe(100000);
      expect(prompt.config.prioritizeRecent).toBeUndefined();
    });

    it('should accept compression levels', () => {
      const configs: SystemPromptConfig[] = [
        { compressionLevel: 'none' },
        { compressionLevel: 'light' },
        { compressionLevel: 'aggressive' },
      ];

      for (const config of configs) {
        const prompt = REFACTORING_LONG_CONTEXT(config);
        expect(prompt.config.compressionLevel).toBe(config.compressionLevel);
      }
    });
  });

  describe('Token counts', () => {
    it('should have realistic token estimates', () => {
      expect(CODE_GENERATION_LONG_CONTEXT().tokens).toBeGreaterThan(0);
      expect(DEBUGGING_LONG_CONTEXT().tokens).toBeGreaterThan(0);
      expect(REFACTORING_LONG_CONTEXT().tokens).toBeGreaterThan(0);
      expect(REASONING_LONG_CONTEXT().tokens).toBeGreaterThan(0);
    });

    it('should have different token counts for different prompts', () => {
      const counts = [
        CODE_GENERATION_LONG_CONTEXT().tokens,
        DEBUGGING_LONG_CONTEXT().tokens,
        REFACTORING_LONG_CONTEXT().tokens,
        REASONING_LONG_CONTEXT().tokens,
      ];

      // All should be unique
      expect(new Set(counts).size).toBe(4);
    });

    it('should have increasing complexity reflected in tokens', () => {
      // Reasoning is most complex, should have most tokens
      expect(REASONING_LONG_CONTEXT().tokens).toBeGreaterThan(CODE_GENERATION_LONG_CONTEXT().tokens);
      
      // Refactoring is more complex than code generation
      expect(REFACTORING_LONG_CONTEXT().tokens).toBeGreaterThan(CODE_GENERATION_LONG_CONTEXT().tokens);
    });
  });
});
