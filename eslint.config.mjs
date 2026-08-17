import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['packages/**/*.ts', 'packages/**/*.tsx'],
    ignores: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      'complexity': ['error', { max: 10 }],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', { max: 5 }],
      'max-nested-callbacks': ['error', { max: 3 }],
      'max-params': ['error', { max: 4 }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
];
