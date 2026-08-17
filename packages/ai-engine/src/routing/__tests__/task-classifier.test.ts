/**
 * Tests for task classification.
 */

import { classifyTask, STRUCTURAL_THRESHOLDS, tierForComplexity } from '../task-classifier';
import type { Task } from '../types';

function task(prompt: string, extra: Partial<Task> = {}): Task {
  return { id: 't', prompt, ...extra };
}

describe('classifyTask', () => {
  describe('simple tasks', () => {
    it.each([
      'format this file with prettier',
      'fix the indentation in utils.ts',
      'run the linter and remove unused imports',
      'does this compile?',
      'read the file src/index.ts',
      'show me the exports of this module',
      'where is the AIProvider class defined',
      'rename getCwd to getCurrentWorkingDirectory',
      'write a commit message for this diff',
    ])('classifies %j as simple', (prompt) => {
      expect(classifyTask(task(prompt)).complexity).toBe('simple');
    });

    it('routes simple work to the cheap lane', () => {
      const result = classifyTask(task('format this file'));
      expect(tierForComplexity(result.complexity)).toBe('cheap');
    });
  });

  describe('medium tasks', () => {
    it.each([
      'fix the bug where login throws on empty passwords',
      'add a new endpoint for user preferences',
      'implement support for dark mode',
      'write unit tests for the token counter',
      'review this diff',
      'document the public API',
    ])('classifies %j as medium', (prompt) => {
      expect(classifyTask(task(prompt)).complexity).toBe('medium');
    });
  });

  describe('complex tasks', () => {
    it.each([
      'redesign the architecture of the provider layer',
      'refactor the registry into separate modules',
      'migrate the database layer to Postgres',
      'why does the stream hang intermittently',
      'there is a race condition in the session manager',
      'run a security audit on the auth flow',
      'explain why this approach is faster, step by step',
    ])('classifies %j as complex', (prompt) => {
      expect(classifyTask(task(prompt)).complexity).toBe('complex');
    });

    it('routes complex work to the expensive lane', () => {
      const result = classifyTask(task('refactor the architecture'));
      expect(tierForComplexity(result.complexity)).toBe('expensive');
    });
  });

  describe('explicit kind', () => {
    it('trusts an explicit kind over the prompt text', () => {
      const result = classifyTask(task('refactor the whole architecture', { kind: 'formatting' }));
      expect(result.complexity).toBe('simple');
      expect(result.kind).toBe('formatting');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('reports the explicit kind as a signal', () => {
      const result = classifyTask(task('anything', { kind: 'bug-fix' }));
      expect(result.signals.join(' ')).toContain('explicit kind');
    });
  });

  describe('confidence', () => {
    it('is low when nothing matches', () => {
      const result = classifyTask(task('hmm'));
      expect(result.confidence).toBeLessThan(0.4);
      expect(result.complexity).toBe('medium');
      expect(result.kind).toBeUndefined();
    });

    it('rises with corroborating signals', () => {
      const weak = classifyTask(task('rename this'));
      const strong = classifyTask(task('refactor and restructure to decouple these modules'));
      expect(strong.confidence).toBeGreaterThan(weak.confidence);
    });
  });

  describe('structural signals', () => {
    it('bumps a simple task to medium on file count', () => {
      const result = classifyTask(
        task('format these files', { fileCount: STRUCTURAL_THRESHOLDS.mediumFileCount })
      );
      expect(result.complexity).toBe('medium');
    });

    it('bumps a simple task to complex on high file count', () => {
      const result = classifyTask(
        task('format these files', { fileCount: STRUCTURAL_THRESHOLDS.complexFileCount })
      );
      expect(result.complexity).toBe('complex');
    });

    it('bumps on token estimate', () => {
      expect(
        classifyTask(task('read this file', { estimatedTokens: STRUCTURAL_THRESHOLDS.mediumTokens }))
          .complexity
      ).toBe('medium');
      expect(
        classifyTask(task('read this file', { estimatedTokens: STRUCTURAL_THRESHOLDS.complexTokens }))
          .complexity
      ).toBe('complex');
    });

    it('never downgrades a complex task', () => {
      const result = classifyTask(task('refactor the architecture', { fileCount: 1, estimatedTokens: 10 }));
      expect(result.complexity).toBe('complex');
    });

    it('forces complex when reasoning is required', () => {
      const result = classifyTask(task('format this file', { requiresReasoning: true }));
      expect(result.complexity).toBe('complex');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('records the structural signal that caused a bump', () => {
      const result = classifyTask(task('format this', { fileCount: 20 }));
      expect(result.signals.join(' ')).toContain('20 files');
    });
  });

  it('resolves mixed signals toward the more complex reading', () => {
    // "refactor" (complex) and "format" (simple) both match; the safer reading wins.
    const result = classifyTask(task('refactor and format this module'));
    expect(result.complexity).toBe('complex');
  });

  it('handles an empty prompt without throwing', () => {
    expect(() => classifyTask(task(''))).not.toThrow();
    expect(classifyTask(task('')).complexity).toBe('medium');
  });
});
