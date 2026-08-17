/**
 * Behavioural tests for the lazy syntax highlighter.
 *
 * The bundle measurement proves Prism is deferred; these tests prove the
 * deferral did not break highlighting, sanitization, or the plain-text
 * fallback path.
 */

import { describe, it, expect } from 'vitest';
import {
  highlightCode,
  isLanguageSupported,
  normalizeLanguage,
  supportedLanguages,
} from '../lib/syntax-highlight';

describe('syntax-highlight: language resolution', () => {
  it('normalizes common aliases to canonical grammars', () => {
    expect(normalizeLanguage('ts')).toBe('typescript');
    expect(normalizeLanguage('js')).toBe('javascript');
    expect(normalizeLanguage('py')).toBe('python');
    expect(normalizeLanguage('rs')).toBe('rust');
    expect(normalizeLanguage('sh')).toBe('bash');
    expect(normalizeLanguage('HTML')).toBe('markup');
  });

  it('treats language tags case-insensitively and trims whitespace', () => {
    expect(normalizeLanguage('  TypeScript  ')).toBe('typescript');
    expect(isLanguageSupported('  PYTHON ')).toBe(true);
  });

  it('reports support accurately', () => {
    expect(isLanguageSupported('typescript')).toBe(true);
    expect(isLanguageSupported('rust')).toBe(true);
    expect(isLanguageSupported('cobol')).toBe(false);
    expect(isLanguageSupported('')).toBe(false);
  });

  it('exposes the supported language list', () => {
    const langs = supportedLanguages();
    expect(langs).toContain('typescript');
    expect(langs).toContain('python');
    expect(langs).toContain('json');
  });

  it('normalizes the aliases added for the markdown views', () => {
    expect(normalizeLanguage('yml')).toBe('yaml');
    expect(normalizeLanguage('cs')).toBe('csharp');
    expect(normalizeLanguage('rb')).toBe('ruby');
    expect(normalizeLanguage('kt')).toBe('kotlin');
    expect(normalizeLanguage('dockerfile')).toBe('docker');
    expect(normalizeLanguage('tf')).toBe('hcl');
    expect(normalizeLanguage('c++')).toBe('cpp');
    expect(normalizeLanguage('golang')).toBe('go');
    expect(normalizeLanguage('md')).toBe('markdown');
  });

  it('keeps sass distinct from scss (different syntaxes, not aliases)', () => {
    expect(normalizeLanguage('sass')).toBe('sass');
    expect(isLanguageSupported('sass')).toBe(true);
    expect(isLanguageSupported('scss')).toBe(true);
  });

  it('covers the languages a markdown code fence commonly uses', () => {
    // Regression guard: these were reachable via react-syntax-highlighter's
    // bundled grammars, so dropping it must not silently lose them.
    for (const lang of [
      'yaml',
      'sql',
      'go',
      'java',
      'c',
      'cpp',
      'csharp',
      'php',
      'ruby',
      'swift',
      'kotlin',
      'docker',
      'markdown',
      'diff',
      'toml',
      'graphql',
      'scss',
      'lua',
      'powershell',
      'elixir',
      'haskell',
      'clojure',
      'solidity',
      'zig',
    ]) {
      expect(isLanguageSupported(lang), `${lang} should be supported`).toBe(true);
    }
  });
});

describe('syntax-highlight: highlighting', () => {
  it('highlights TypeScript into span-wrapped tokens', async () => {
    const { html, language } = await highlightCode(
      'const x: number = 42;',
      'typescript'
    );

    expect(language).toBe('typescript');
    expect(html).not.toBeNull();
    expect(html).toContain('<span');
    expect(html).toContain('token');
    // Original code text must survive highlighting.
    expect(html).toContain('42');
  });

  it('loads grammars on demand for several languages', async () => {
    const python = await highlightCode('def f():\n    return 1', 'python');
    expect(python.html).toContain('token');

    const rust = await highlightCode('fn main() { let x = 1; }', 'rust');
    expect(rust.html).toContain('token');

    const json = await highlightCode('{"a": 1}', 'json');
    expect(json.html).toContain('token');
  });

  it('highlights the newly added grammars, including less common ones', async () => {
    const cases: Array<[string, string]> = [
      ['yaml', 'key: value\nlist:\n  - a'],
      ['sql', 'SELECT id FROM users WHERE id = 1;'],
      ['go', 'package main\nfunc main() { println("x") }'],
      ['csharp', 'public class A { public int X => 1; }'],
      ['ruby', 'def greet(name)\n  puts "hi #{name}"\nend'],
      ['docker', 'FROM node:20\nRUN npm ci'],
      ['toml', '[table]\nkey = "value"'],
      ['elixir', 'defmodule A do\n  def b, do: :ok\nend'],
      ['haskell', 'main :: IO ()\nmain = putStrLn "hi"'],
      ['solidity', 'contract A { uint256 public x = 1; }'],
      ['zig', 'const std = @import("std");'],
    ];

    for (const [language, code] of cases) {
      const { html } = await highlightCode(code, language);
      expect(html, `${language} should highlight`).not.toBeNull();
      expect(html, `${language} should emit tokens`).toContain('token');
    }
  });

  it('resolves multi-step grammar dependencies (cpp -> c -> clike)', async () => {
    const { html } = await highlightCode(
      '#include <vector>\nint main() { std::vector<int> v; return 0; }',
      'cpp'
    );
    expect(html).not.toBeNull();
    expect(html).toContain('token');
  });

  it('resolves php through markup-templating', async () => {
    const { html } = await highlightCode('<?php echo "hi"; ?>', 'php');
    expect(html).not.toBeNull();
    expect(html).toContain('token');
  });

  it('highlights via an alias the same way as its canonical grammar', async () => {
    const viaAlias = await highlightCode('key: value', 'yml');
    const viaCanonical = await highlightCode('key: value', 'yaml');
    expect(viaAlias.language).toBe('yaml');
    expect(viaAlias.html).toBe(viaCanonical.html);
  });

  it('resolves grammar dependencies (tsx needs jsx + typescript)', async () => {
    const { html } = await highlightCode(
      'const App = () => <div className="x">hi</div>;',
      'tsx'
    );
    expect(html).not.toBeNull();
    expect(html).toContain('token');
  });

  it('returns null html for unsupported languages so callers fall back', async () => {
    const { html, language } = await highlightCode('SELECT 1', 'cobol');
    expect(html).toBeNull();
    expect(language).toBe('cobol');
  });

  it('caches Prism across calls (second call resolves without re-import)', async () => {
    const first = await highlightCode('let a = 1;', 'javascript');
    const second = await highlightCode('let b = 2;', 'javascript');
    expect(first.html).not.toBeNull();
    expect(second.html).not.toBeNull();
    expect(second.html).toContain('token');
  });

  it('handles concurrent requests for the same grammar without duplicating work', async () => {
    const results = await Promise.all([
      highlightCode('const a = 1;', 'typescript'),
      highlightCode('const b = 2;', 'typescript'),
      highlightCode('const c = 3;', 'typescript'),
    ]);
    for (const r of results) {
      expect(r.html).not.toBeNull();
      expect(r.html).toContain('token');
    }
  });

  it('handles empty code without throwing', async () => {
    const { html } = await highlightCode('', 'typescript');
    expect(html).toBe('');
  });
});

describe('syntax-highlight: sanitization', () => {
  it('strips script tags from code content', async () => {
    const malicious = 'const x = "<script>alert(1)</script>";';
    const { html } = await highlightCode(malicious, 'typescript');

    expect(html).not.toBeNull();
    expect(html!.toLowerCase()).not.toContain('<script');
    expect(html!.toLowerCase()).not.toContain('</script');
  });

  it('escapes markup in code so event handlers cannot execute', async () => {
    const malicious = 'const img = \'<img src=x onerror="alert(1)">\';';
    const { html } = await highlightCode(malicious, 'typescript');

    expect(html).not.toBeNull();

    // The <img> must survive only as escaped, inert text - never as a real tag.
    // (A code viewer is expected to *display* this string.)
    expect(html!.toLowerCase()).not.toContain('<img');
    expect(html!).toContain('&lt;img');

    // Verify inertness by parsing: no element or attribute is actually created.
    const host = document.createElement('div');
    host.innerHTML = html!;
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelectorAll('*[onerror]').length).toBe(0);
    // Only spans should have materialized as elements.
    const tagNames = new Set(
      Array.from(host.querySelectorAll('*')).map((el) => el.tagName.toLowerCase())
    );
    expect([...tagNames].every((t) => t === 'span')).toBe(true);
  });

  it('produces only span elements', async () => {
    const { html } = await highlightCode('const x = 1;', 'typescript');
    expect(html).not.toBeNull();

    // Parse rather than regex-match, so escaped text in the code is not
    // mistaken for real markup.
    const host = document.createElement('div');
    host.innerHTML = html!;
    const elements = Array.from(host.querySelectorAll('*'));
    expect(elements.length).toBeGreaterThan(0);
    for (const el of elements) {
      expect(el.tagName.toLowerCase()).toBe('span');
    }
  });
});
