/**
 * Tests - FormatService (formatDocument)
 *
 * Couvre la régression : `formatDocument` était un stub qui renvoyait le
 * contenu inchangé, alors que le formatage est une fonctionnalité de base d'un IDE.
 */

import { describe, it, expect } from 'vitest';
import { formatDocument, resolveParser, FormatError } from '../format-service';

describe('resolveParser', () => {
  it('résout le parser depuis le langage Monaco', () => {
    expect(resolveParser('/a/file.ts', 'typescript')).toBe('typescript');
    expect(resolveParser('/a/file.tsx', 'typescriptreact')).toBe('typescript');
    expect(resolveParser('/a/file.js', 'javascript')).toBe('babel');
    expect(resolveParser('/a/file.json', 'json')).toBe('json');
    expect(resolveParser('/a/file.css', 'css')).toBe('css');
    expect(resolveParser('/a/file.md', 'markdown')).toBe('markdown');
    expect(resolveParser('/a/file.yml', 'yaml')).toBe('yaml');
  });

  it('retombe sur l\'extension quand le langage est inconnu', () => {
    expect(resolveParser('/a/file.ts', 'plaintext')).toBe('typescript');
    expect(resolveParser('/a/file.scss', 'unknown-lang')).toBe('scss');
    expect(resolveParser('/a/file.ts')).toBe('typescript');
  });

  it('renvoie undefined pour un langage non supporté', () => {
    expect(resolveParser('/a/file.py', 'python')).toBeUndefined();
    expect(resolveParser('/a/file.rs', 'rust')).toBeUndefined();
    expect(resolveParser('/a/notes.txt', 'plaintext')).toBeUndefined();
  });
});

describe('formatDocument', () => {
  it('formate du TypeScript', async () => {
    const result = await formatDocument({
      path: '/tmp/sample.ts',
      language: 'typescript',
      content: 'const x   =    {a:1,b:2}\n',
    });

    expect(result.formatted).toBe("const x = { a: 1, b: 2 };\n");
    // Le contenu a changé => un edit couvrant tout le document
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].range).toEqual({ start: 0, end: 'const x   =    {a:1,b:2}\n'.length });
    expect(result.changes[0].text).toBe(result.formatted);
  });

  it('applique les defaults Cortex (single quotes, 2 espaces)', async () => {
    const result = await formatDocument({
      path: '/tmp/sample.ts',
      language: 'typescript',
      content: 'function f() {\n    return "hello";\n}\n',
    });

    expect(result.formatted).toContain("'hello'");
    expect(result.formatted).toContain('  return');
  });

  it('formate du JSON', async () => {
    const result = await formatDocument({
      path: '/tmp/data.json',
      language: 'json',
      content: '{"b":2,"a":1}',
    });

    expect(result.formatted).toBe('{ "b": 2, "a": 1 }\n');
  });

  it('formate du CSS', async () => {
    const result = await formatDocument({
      path: '/tmp/style.css',
      language: 'css',
      content: 'body{color:red;margin:0}',
    });

    expect(result.formatted).toBe('body {\n  color: red;\n  margin: 0;\n}\n');
  });

  it('formate du Markdown', async () => {
    const result = await formatDocument({
      path: '/tmp/README.md',
      language: 'markdown',
      content: '#  Titre\n\n\n\nUn   paragraphe.\n',
    });

    expect(result.formatted).toBe('# Titre\n\nUn paragraphe.\n');
  });

  it('ne renvoie aucun change si le contenu est déjà formaté', async () => {
    const alreadyFormatted = "const x = { a: 1, b: 2 };\n";

    const result = await formatDocument({
      path: '/tmp/sample.ts',
      language: 'typescript',
      content: alreadyFormatted,
    });

    expect(result.formatted).toBe(alreadyFormatted);
    expect(result.changes).toHaveLength(0);
  });

  it('lève FormatError sur du contenu syntaxiquement invalide', async () => {
    await expect(
      formatDocument({
        path: '/tmp/broken.ts',
        language: 'typescript',
        content: 'const x = {{{ unclosed',
      })
    ).rejects.toThrow(FormatError);
  });

  it('ne modifie jamais le contenu original en cas d\'échec', async () => {
    const original = 'const x = {{{ unclosed';

    try {
      await formatDocument({
        path: '/tmp/broken.ts',
        language: 'typescript',
        content: original,
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(FormatError);
    }

    expect(original).toBe('const x = {{{ unclosed');
  });

  it('lève FormatError pour un langage non supporté', async () => {
    await expect(
      formatDocument({
        path: '/tmp/script.py',
        language: 'python',
        content: 'def f():pass',
      })
    ).rejects.toThrow(/No formatter available/);
  });

  it('gère les gros fichiers', async () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `const v${i}   =   ${i};`);

    const result = await formatDocument({
      path: '/tmp/big.ts',
      language: 'typescript',
      content: lines.join('\n'),
    });

    expect(result.formatted.split('\n')).toHaveLength(2001); // + newline final
    expect(result.formatted).toContain('const v0 = 0;');
    expect(result.formatted).toContain('const v1999 = 1999;');
  });
});
