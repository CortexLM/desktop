import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleMinifier } from '../simple-minifier';

describe('SimpleMinifier', () => {
  let minifier: SimpleMinifier;

  beforeEach(() => {
    minifier = new SimpleMinifier();
  });

  it('should remove line comments', () => {
    const content = `const x = 1; // This is a comment
const y = 2; // Another comment`;
    
    const minified = minifier.minify(content);
    
    expect(minified).not.toContain('This is a comment');
    expect(minified).not.toContain('Another comment');
    expect(minified).toContain('const x = 1;');
    expect(minified).toContain('const y = 2;');
  });

  it('should remove block comments', () => {
    const content = `/* Block comment
    multi-line
    */
const x = 1;
/* Another block */`;
    
    const minified = minifier.minify(content);
    
    expect(minified).not.toContain('Block comment');
    expect(minified).not.toContain('multi-line');
    expect(minified).toContain('const x = 1;');
  });

  it('should remove empty lines', () => {
    const content = `const x = 1;

const y = 2;


const z = 3;`;
    
    const minified = minifier.minify(content);
    
    expect(minified.split('\n')).toHaveLength(3);
  });

  it('should trim whitespace', () => {
    const content = `   const x = 1;   
    const y = 2;     `;
    
    const minified = minifier.minify(content);
    
    expect(minified).toBe('const x = 1;\nconst y = 2;');
  });

  it('should estimate savings correctly', () => {
    const content = `// This is a comment
const x = 1; // inline comment

/* Block
   comment */
const y = 2;


const z = 3;`;
    
    const savings = minifier.estimateSavings(content);
    
    expect(savings).toBeGreaterThan(30); // Au moins 30% de réduction
    expect(savings).toBeLessThanOrEqual(100);
  });

  it('should handle code without comments', () => {
    const content = `const x = 1;
const y = 2;
const z = 3;`;
    
    const minified = minifier.minify(content);
    
    expect(minified).toBe('const x = 1;\nconst y = 2;\nconst z = 3;');
  });

  it('should handle empty input', () => {
    const content = '';
    const minified = minifier.minify(content);
    expect(minified).toBe('');
  });

  it('should preserve code structure', () => {
    const content = `function test() {
  // Comment inside
  return 42; // Return value
}`;
    
    const minified = minifier.minify(content);
    
    expect(minified).toContain('function test() {');
    expect(minified).toContain('return 42;');
    expect(minified).toContain('}');
    expect(minified).not.toContain('Comment inside');
  });
});
