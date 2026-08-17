/**
 * Common test fixtures
 */

/**
 * Sample TypeScript code
 */
export const sampleTypeScriptCode = `
import { Component } from './types';

export class MyComponent implements Component {
  private name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  render(): string {
    return \`<div>\${this.name}</div>\`;
  }
  
  update(newName: string): void {
    this.name = newName;
  }
}
`.trim();

/**
 * Sample React component
 */
export const sampleReactComponent = `
import React, { useState } from 'react';

export const Counter: React.FC = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
};
`.trim();

/**
 * Sample API responses
 */
export const apiResponses = {
  user: {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin'
  },
  
  chat: {
    id: 'chat-456',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ],
    model: 'gpt-4',
    createdAt: '2024-01-01T00:00:00Z'
  },
  
  error: {
    error: {
      code: 'INVALID_REQUEST',
      message: 'Invalid request parameters',
      details: {}
    }
  }
};

/**
 * Sample file trees
 */
export const sampleFileTree = {
  'package.json': JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    scripts: { test: 'vitest' }
  }, null, 2),
  
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext'
    }
  }, null, 2),
  
  'src': {
    'index.ts': 'export * from "./lib";',
    'lib.ts': 'export const version = "1.0.0";',
    'utils': {
      'helpers.ts': 'export const add = (a: number, b: number) => a + b;',
      'validators.ts': 'export const isEmail = (s: string) => s.includes("@");'
    }
  },
  
  'tests': {
    'index.test.ts': 'import { describe, it, expect } from "vitest";'
  }
};

/**
 * Sample Git states
 */
export const gitStates = {
  clean: {
    modified: [],
    staged: [],
    untracked: [],
    branch: 'main',
    ahead: 0,
    behind: 0
  },
  
  modified: {
    modified: ['src/index.ts', 'src/lib.ts'],
    staged: [],
    untracked: [],
    branch: 'main',
    ahead: 0,
    behind: 0
  },
  
  staged: {
    modified: [],
    staged: ['src/index.ts'],
    untracked: [],
    branch: 'main',
    ahead: 0,
    behind: 0
  },
  
  diverged: {
    modified: [],
    staged: [],
    untracked: [],
    branch: 'feature',
    ahead: 3,
    behind: 2
  }
};

/**
 * Sample error messages
 */
export const errorMessages = {
  fileNotFound: 'ENOENT: no such file or directory',
  permissionDenied: 'EACCES: permission denied',
  networkError: 'Network request failed',
  timeout: 'Request timeout',
  validation: 'Validation failed',
  unauthorized: 'Unauthorized access',
  rateLimited: 'Rate limit exceeded'
};
