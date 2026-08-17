import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticChunker } from '../chunking/semantic-chunker';
import type { ContextChunk } from '../types';

describe('SemanticChunker', () => {
  let chunker: SemanticChunker;

  beforeEach(() => {
    chunker = new SemanticChunker({
      maxChunkSize: 500,
      minChunkSize: 50,
      preserveBoundaries: true,
      includeDependencies: true,
      maxDependencyDepth: 2,
    });
  });

  describe('TypeScript chunking', () => {
    it('should chunk functions correctly', async () => {
      const content = `
export function processData(input: string): string {
  const trimmed = input.trim();
  return trimmed.toUpperCase();
}

export function calculateSum(a: number, b: number): number {
  return a + b;
}
`;

      const chunks = await chunker.chunk(content, 'test.ts', 'typescript');
      
      // Vérifie qu'on a des chunks (peut être plus de 2 à cause des lignes vides initiales)
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      
      // Vérifie que les fonctions sont détectées
      const functionChunks = chunks.filter(c => c.metadata.functionName);
      expect(functionChunks.length).toBeGreaterThanOrEqual(2);
      
      const functionNames = functionChunks.map(c => c.metadata.functionName);
      expect(functionNames).toContain('processData');
      expect(functionNames).toContain('calculateSum');
    });

    it('should chunk classes correctly', async () => {
      const content = `
export class DataProcessor {
  private data: string[];

  constructor(data: string[]) {
    this.data = data;
  }

  process(): string[] {
    return this.data.map(d => d.trim());
  }
}

export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
`;

      const chunks = await chunker.chunk(content, 'test.ts', 'typescript');
      
      // Vérifie qu'on a des chunks
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      
      // Vérifie que les classes sont détectées
      const classChunks = chunks.filter(c => c.metadata.className);
      expect(classChunks.length).toBeGreaterThanOrEqual(2);
      
      const classNames = classChunks.map(c => c.metadata.className);
      expect(classNames).toContain('DataProcessor');
      expect(classNames).toContain('Calculator');
    });

    it('should handle interfaces and types', async () => {
      const content = `
export interface User {
  id: string;
  name: string;
  email: string;
}

export type Status = 'active' | 'inactive' | 'pending';

export interface Product {
  id: string;
  price: number;
}
`;

      const chunks = await chunker.chunk(content, 'test.ts', 'typescript');
      
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.some(c => c.content.includes('interface User'))).toBe(true);
      expect(chunks.some(c => c.content.includes('type Status'))).toBe(true);
    });

    it('should respect max chunk size', async () => {
      const content = Array(100)
        .fill(0)
        .map((_, i) => `const var${i} = ${i};`)
        .join('\n');

      const chunks = await chunker.chunk(content, 'test.ts', 'typescript');
      
      chunks.forEach(chunk => {
        expect(chunk.tokens).toBeLessThanOrEqual(500);
      });
    });
  });

  describe('Python chunking', () => {
    it('should chunk Python functions correctly', async () => {
      const content = `def process_data(input_str):
    trimmed = input_str.strip()
    return trimmed.upper()

def calculate_sum(a, b):
    return a + b
`;

      const chunks = await chunker.chunk(content, 'test.py', 'python');
      
      // Vérifie qu'on a des chunks
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      
      // Vérifie que les fonctions sont détectées
      const functionChunks = chunks.filter(c => c.metadata.functionName);
      expect(functionChunks.length).toBeGreaterThanOrEqual(1);
      
      const functionNames = functionChunks.map(c => c.metadata.functionName);
      expect(functionNames.length).toBeGreaterThan(0);
    });

    it('should chunk Python classes correctly', async () => {
      const content = `class DataProcessor:
    def __init__(self, data):
        self.data = data
    
    def process(self):
        return [d.strip() for d in self.data]

class Calculator:
    def add(self, a, b):
        return a + b
`;

      const chunks = await chunker.chunk(content, 'test.py', 'python');
      
      // Vérifie qu'on a des chunks
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      
      // Vérifie que les classes sont détectées
      const classChunks = chunks.filter(c => c.metadata.className);
      expect(classChunks.length).toBeGreaterThanOrEqual(1);
      
      const classNames = classChunks.map(c => c.metadata.className);
      expect(classNames.length).toBeGreaterThan(0);
    });

    it('should handle indentation correctly', async () => {
      const content = `def outer_function():
    def inner_function():
        return 42
    return inner_function()

def another_function():
    pass
`;

      const chunks = await chunker.chunk(content, 'test.py', 'python');
      
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      const outerChunk = chunks.find(c => c.metadata.functionName === 'outer_function');
      expect(outerChunk).toBeDefined();
      expect(outerChunk!.content).toContain('inner_function');
    });
  });

  describe('Rust chunking', () => {
    it('should chunk Rust functions correctly', async () => {
      const content = `pub fn process_data(input: &str) -> String {
    input.trim().to_uppercase()
}

fn calculate_sum(a: i32, b: i32) -> i32 {
    a + b
}
`;

      const chunks = await chunker.chunk(content, 'test.rs', 'rust');
      
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      const functionChunks = chunks.filter(c => c.metadata.functionName);
      expect(functionChunks.length).toBeGreaterThanOrEqual(2);
      
      const functionNames = functionChunks.map(c => c.metadata.functionName);
      expect(functionNames).toContain('process_data');
      expect(functionNames).toContain('calculate_sum');
    });

    it('should chunk Rust structs and impls correctly', async () => {
      const content = `
pub struct DataProcessor {
    data: Vec<String>,
}

impl DataProcessor {
    pub fn new(data: Vec<String>) -> Self {
        Self { data }
    }
    
    pub fn process(&self) -> Vec<String> {
        self.data.iter().map(|s| s.trim().to_string()).collect()
    }
}
`;

      const chunks = await chunker.chunk(content, 'test.rs', 'rust');
      
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.some(c => c.content.includes('struct DataProcessor'))).toBe(true);
      expect(chunks.some(c => c.content.includes('impl DataProcessor'))).toBe(true);
    });
  });

  describe('Single-line declarations', () => {
    // Régression : une déclaration dont les accolades ouvrent et ferment sur la
    // même ligne a un delta nul. Une détection basée sur le delta seul ne voyait
    // jamais la fin de la déclaration et fusionnait tout dans un seul chunk.
    it('should separate declarations that open and close on one line', async () => {
      const content = [
        'export function a() { return 1; }',
        'export class B { m() { return 2; } }',
        'export function c() { return 3; }',
      ].join('\n');

      const chunks = await chunker.chunk(content, 'x.ts', 'typescript');

      expect(chunks.length).toBe(3);
      expect(chunks.map(c => c.metadata.functionName ?? c.metadata.className)).toEqual([
        'a',
        'B',
        'c',
      ]);
    });

    it('should not merge a one-line function into the next declaration', async () => {
      const content = ['function first() { return 1; }', '', 'function second() {', '  return 2;', '}'].join('\n');

      const chunks = await chunker.chunk(content, 'y.ts', 'typescript');

      const names = chunks.map(c => c.metadata.functionName);
      expect(names).toContain('first');
      expect(names).toContain('second');
      const firstChunk = chunks.find(c => c.metadata.functionName === 'first');
      expect(firstChunk!.content).not.toContain('second');
    });
  });

  describe('Generic chunking', () => {
    it('should chunk generic text files', async () => {
      const content = Array(200)
        .fill('Lorem ipsum dolor sit amet')
        .join('\n');

      const chunks = await chunker.chunk(content, 'test.txt');
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.tokens).toBeLessThanOrEqual(500);
      });
    });
  });

  describe('Dependency graph', () => {
    it('should build dependency graph from chunks', () => {
      const chunks: ContextChunk[] = [
        {
          id: 'file1:0',
          content: 'function processUser(user: User) { return user.name; }',
          tokens: 50,
          type: 'code',
          metadata: {
            functionName: 'processUser',
            filePath: 'file1.ts',
          },
        },
        {
          id: 'file2:0',
          content: 'interface User { name: string; email: string; }',
          tokens: 30,
          type: 'code',
          metadata: {
            className: 'User',
            filePath: 'file2.ts',
          },
        },
        {
          id: 'file3:0',
          content: 'function validateEmail(email: string) { return true; }',
          tokens: 40,
          type: 'code',
          metadata: {
            functionName: 'validateEmail',
            filePath: 'file3.ts',
          },
        },
      ];

      const graph = chunker.buildDependencyGraph(chunks);
      
      expect(graph.size).toBe(3);
      expect(graph.get('file1:0')!.has('file2:0')).toBe(true);
    });

    it('should detect function references', () => {
      const chunks: ContextChunk[] = [
        {
          id: 'file1:0',
          content: 'function main() { const result = calculateSum(1, 2); }',
          tokens: 50,
          type: 'code',
          metadata: {
            functionName: 'main',
            filePath: 'file1.ts',
          },
        },
        {
          id: 'file2:0',
          content: 'function calculateSum(a, b) { return a + b; }',
          tokens: 30,
          type: 'code',
          metadata: {
            functionName: 'calculateSum',
            filePath: 'file2.ts',
          },
        },
      ];

      const graph = chunker.buildDependencyGraph(chunks);
      
      expect(graph.get('file1:0')!.has('file2:0')).toBe(true);
    });
  });

  describe('Metadata', () => {
    it('should include correct metadata in chunks', async () => {
      const content = `export function testFunction() {
  return 'test';
}
`;

      const chunks = await chunker.chunk(content, '/path/to/test.ts', 'typescript');
      
      const funcChunk = chunks.find(c => c.metadata.functionName === 'testFunction');
      expect(funcChunk).toBeDefined();
      expect(funcChunk!.metadata.filePath).toBe('/path/to/test.ts');
      expect(funcChunk!.metadata.startLine).toBeDefined();
      expect(funcChunk!.metadata.endLine).toBeDefined();
      expect(funcChunk!.metadata.lastModified).toBeInstanceOf(Date);
    });

    it('should calculate token estimates', async () => {
      const content = 'a'.repeat(400); // 400 chars
      const chunks = await chunker.chunk(content, 'test.txt');
      
      expect(chunks[0].tokens).toBeCloseTo(100, 0); // ~400/4 = 100 tokens
    });
  });
});
