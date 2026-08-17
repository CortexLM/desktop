import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  extractSignatures,
  summarizeCode,
  extractKeyInfo,
  summarizeFileTree,
  compressToTarget,
  type CompressionConfig,
} from '../compression';

describe('Compression Module', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const text = 'a'.repeat(100);
      const tokens = estimateTokens(text);
      expect(tokens).toBe(25); // 100 / 4
    });

    it('should round up token count', () => {
      const text = 'a'.repeat(101);
      const tokens = estimateTokens(text);
      expect(tokens).toBe(26); // ceil(101 / 4)
    });

    it('should handle empty text', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('extractSignatures', () => {
    it('should extract function signatures', () => {
      const code = `
export function test(param: string): void {
  console.log(param);
}

function helper() {
  return 42;
}
`;

      const signatures = extractSignatures(code);
      expect(signatures).toContain('export function test(param: string): void');
      expect(signatures).toContain('function helper()');
      expect(signatures).not.toContain('console.log');
    });

    it('should extract class signatures', () => {
      const code = `
export class MyClass {
  private value: number;
  
  constructor() {
    this.value = 0;
  }
}
`;

      const signatures = extractSignatures(code);
      expect(signatures).toContain('export class MyClass');
    });

    it('should skip comments', () => {
      const code = `
// This is a comment
function test() {
  /* Block comment */
  return 1;
}
`;

      const signatures = extractSignatures(code);
      expect(signatures).not.toContain('// This is a comment');
      expect(signatures).not.toContain('/* Block comment */');
    });

    it('should handle empty code', () => {
      const signatures = extractSignatures('');
      expect(signatures).toBe('');
    });
  });

  describe('summarizeCode', () => {
    const testCode = `
import { test } from 'module';

export function myFunction() {
  const x = 1;
  const y = 2;
  return x + y;
}

// Helper
function helper() {
  return 'helper';
}
`;

    it('should compress with light level', () => {
      const config: CompressionConfig = {
        targetTokens: 1000,
        summarizationLevel: 'light',
      };

      const result = summarizeCode(testCode, config);

      expect(result.compressed).not.toContain('\n\n\n');
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
    });

    it('should compress with medium level', () => {
      const config: CompressionConfig = {
        targetTokens: 1000,
        summarizationLevel: 'medium',
        keepTypes: true,
        preserveStructure: true,
      };

      const result = summarizeCode(testCode, config);

      expect(result.compressed).toContain('export function myFunction()');
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    });

    it('should compress with aggressive level', () => {
      const config: CompressionConfig = {
        targetTokens: 1000,
        summarizationLevel: 'aggressive',
      };

      const result = summarizeCode(testCode, config);

      expect(result.compressed).toContain('import');
      expect(result.compressed).toContain('export');
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    });
  });

  describe('extractKeyInfo', () => {
    it('should extract imports', () => {
      const code = `
import { a } from 'module-a';
import b from 'module-b';
export function test() {}
`;

      const info = extractKeyInfo(code);

      expect(info.imports.length).toBe(2);
      expect(info.imports[0]).toContain('import { a }');
    });

    it('should extract exports', () => {
      const code = `
export function test() {}
export const value = 1;
export class MyClass {}
`;

      const info = extractKeyInfo(code);

      expect(info.exports.length).toBe(3);
    });

    it('should extract types', () => {
      const code = `
interface MyInterface {
  value: number;
}

type MyType = string | number;
`;

      const info = extractKeyInfo(code);

      expect(info.types.length).toBe(2);
      expect(info.types[0]).toContain('interface MyInterface');
      expect(info.types[1]).toContain('type MyType');
    });

    it('should extract functions', () => {
      const code = `
function test() {}
const arrow = () => {};
export const exported = () => {};
`;

      const info = extractKeyInfo(code);

      expect(info.functions.length).toBeGreaterThan(0);
    });

    it('should extract classes', () => {
      const code = `
class MyClass {}
export class ExportedClass {}
`;

      const info = extractKeyInfo(code);

      expect(info.classes.length).toBe(2);
    });
  });

  describe('summarizeFileTree', () => {
    it('should summarize multiple files', () => {
      const files = new Map<string, string>([
        ['file1.ts', 'export function a() {}\nexport function b() {}'],
        ['file2.ts', 'export const x = 1;'],
        ['file3.ts', 'function internal() {}'],
      ]);

      const config: CompressionConfig = {
        targetTokens: 1000,
        summarizationLevel: 'medium',
      };

      const summaries = summarizeFileTree(files, config);

      expect(summaries.length).toBe(3);
      expect(summaries[0].path).toBeDefined();
      expect(summaries[0].summary).toBeDefined();
      expect(summaries[0].tokens).toBeGreaterThan(0);
    });

    it('should sort by number of exports', () => {
      const files = new Map<string, string>([
        ['few.ts', 'export const x = 1;'],
        ['many.ts', 'export const a = 1;\nexport const b = 2;\nexport const c = 3;'],
        ['none.ts', 'const x = 1;'],
      ]);

      const config: CompressionConfig = {
        targetTokens: 1000,
        summarizationLevel: 'light',
      };

      const summaries = summarizeFileTree(files, config);

      // File with most exports should be first
      expect(summaries[0].keyExports?.length).toBeGreaterThan(summaries[1].keyExports?.length || 0);
    });
  });

  describe('compressToTarget', () => {
    const longCode = `
import { something } from 'module';

export function function1() {
  const x = 1;
  return x;
}

export function function2() {
  const y = 2;
  return y;
}

export function function3() {
  const z = 3;
  return z;
}
`.repeat(10);

    it('should compress to target token count', () => {
      const result = compressToTarget(longCode, 100, {
        preserveStructure: true,
        keepTypes: true,
        summarizationLevel: 'medium',
      });

      expect(result.compressedTokens).toBeLessThanOrEqual(100);
      expect(result.originalTokens).toBeGreaterThan(result.compressedTokens);
    });

    it('should use progressive compression levels', () => {
      const result = compressToTarget(longCode, 50, {
        preserveStructure: true,
        keepTypes: true,
      });

      expect(result.compressedTokens).toBeLessThanOrEqual(50);
    });

    it('should truncate if necessary', () => {
      const result = compressToTarget(longCode, 10, {
        preserveStructure: true,
        keepTypes: true,
      });

      expect(result.compressed).toContain('... (truncated)');
      expect(result.compressedTokens).toBeLessThanOrEqual(10);
    });
  });
});
