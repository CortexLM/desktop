import { describe, it, expect } from 'vitest';
import { detectLanguage, DEFAULT_LANGUAGE } from '../shared/language';

describe('detectLanguage', () => {
  it('detects TypeScript', () => {
    expect(detectLanguage('/src/app.ts')).toBe('typescript');
    expect(detectLanguage('/src/app.tsx')).toBe('typescript');
  });

  it('detects JavaScript', () => {
    expect(detectLanguage('/src/app.js')).toBe('javascript');
    expect(detectLanguage('/src/app.jsx')).toBe('javascript');
  });

  it('maps C/C++ headers to their language', () => {
    expect(detectLanguage('a.h')).toBe('c');
    expect(detectLanguage('a.hpp')).toBe('cpp');
    expect(detectLanguage('a.c')).toBe('c');
    expect(detectLanguage('a.cpp')).toBe('cpp');
  });

  it('maps every shell dialect to shell', () => {
    expect(detectLanguage('a.sh')).toBe('shell');
    expect(detectLanguage('a.bash')).toBe('shell');
    expect(detectLanguage('a.zsh')).toBe('shell');
  });

  it('maps both YAML extensions', () => {
    expect(detectLanguage('a.yaml')).toBe('yaml');
    expect(detectLanguage('a.yml')).toBe('yaml');
  });

  it('is case insensitive on the extension', () => {
    expect(detectLanguage('README.MD')).toBe('markdown');
    expect(detectLanguage('App.TSX')).toBe('typescript');
  });

  it('falls back to the default language for unknown extensions', () => {
    expect(detectLanguage('archive.tar.gz')).toBe(DEFAULT_LANGUAGE);
    expect(detectLanguage('binary.exe')).toBe(DEFAULT_LANGUAGE);
  });

  it('falls back to the default language when there is no extension', () => {
    expect(detectLanguage('Makefile')).toBe(DEFAULT_LANGUAGE);
    expect(detectLanguage('/etc/hosts')).toBe(DEFAULT_LANGUAGE);
  });

  it('uses the last extension of a multi-part name', () => {
    expect(detectLanguage('component.test.ts')).toBe('typescript');
    expect(detectLanguage('styles.module.css')).toBe('css');
  });

  it('handles dotfiles without a separate extension', () => {
    expect(detectLanguage('.gitignore')).toBe(DEFAULT_LANGUAGE);
  });
});
