/**
 * Test data builders using the Builder pattern
 */

import { faker } from '@faker-js/faker';

/**
 * Base builder class
 */
abstract class Builder<T> {
  protected data: Partial<T> = {};

  abstract build(): T;

  with(updates: Partial<T>): this {
    Object.assign(this.data, updates);
    return this;
  }

  reset(): this {
    this.data = {};
    return this;
  }
}

/**
 * User builder
 */
export class UserBuilder extends Builder<{
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: Date;
}> {
  constructor() {
    super();
    this.data = {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      role: 'user',
      createdAt: new Date()
    };
  }

  withAdmin(): this {
    this.data.role = 'admin';
    return this;
  }

  withViewer(): this {
    this.data.role = 'viewer';
    return this;
  }

  build() {
    return {
      id: this.data.id!,
      name: this.data.name!,
      email: this.data.email!,
      role: this.data.role!,
      createdAt: this.data.createdAt!
    };
  }
}

/**
 * AI Message builder
 */
export class AIMessageBuilder extends Builder<{
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
  model?: string;
}> {
  constructor() {
    super();
    this.data = {
      id: faker.string.uuid(),
      role: 'user',
      content: faker.lorem.sentence(),
      timestamp: new Date()
    };
  }

  asUser(): this {
    this.data.role = 'user';
    return this;
  }

  asAssistant(): this {
    this.data.role = 'assistant';
    return this;
  }

  asSystem(): this {
    this.data.role = 'system';
    return this;
  }

  withContent(content: string): this {
    this.data.content = content;
    return this;
  }

  withModel(model: string): this {
    this.data.model = model;
    return this;
  }

  withTokens(tokens: number): this {
    this.data.tokens = tokens;
    return this;
  }

  build() {
    return {
      id: this.data.id!,
      role: this.data.role!,
      content: this.data.content!,
      timestamp: this.data.timestamp!,
      tokens: this.data.tokens,
      model: this.data.model
    };
  }
}

/**
 * File builder
 */
export class FileBuilder extends Builder<{
  path: string;
  content: string;
  language: string;
  size: number;
  lastModified: Date;
}> {
  constructor() {
    super();
    this.data = {
      path: faker.system.filePath(),
      content: faker.lorem.paragraphs(3),
      language: 'typescript',
      size: 0,
      lastModified: new Date()
    };
  }

  withPath(path: string): this {
    this.data.path = path;
    return this;
  }

  withContent(content: string): this {
    this.data.content = content;
    this.data.size = content.length;
    return this;
  }

  withLanguage(language: string): this {
    this.data.language = language;
    return this;
  }

  asTypeScript(): this {
    this.data.language = 'typescript';
    this.data.path = this.data.path?.replace(/\.[^.]+$/, '.ts') || 'file.ts';
    return this;
  }

  asJavaScript(): this {
    this.data.language = 'javascript';
    this.data.path = this.data.path?.replace(/\.[^.]+$/, '.js') || 'file.js';
    return this;
  }

  asPython(): this {
    this.data.language = 'python';
    this.data.path = this.data.path?.replace(/\.[^.]+$/, '.py') || 'file.py';
    return this;
  }

  build() {
    return {
      path: this.data.path!,
      content: this.data.content!,
      language: this.data.language!,
      size: this.data.size || this.data.content!.length,
      lastModified: this.data.lastModified!
    };
  }
}

/**
 * Workspace builder
 */
export class WorkspaceBuilder extends Builder<{
  name: string;
  path: string;
  files: Array<{ path: string; content: string }>;
  settings: Record<string, any>;
}> {
  constructor() {
    super();
    this.data = {
      name: faker.word.noun() + '-workspace',
      path: faker.system.directoryPath(),
      files: [],
      settings: {}
    };
  }

  withFile(path: string, content: string): this {
    this.data.files = this.data.files || [];
    this.data.files.push({ path, content });
    return this;
  }

  withFiles(files: Array<{ path: string; content: string }>): this {
    this.data.files = files;
    return this;
  }

  withSettings(settings: Record<string, any>): this {
    this.data.settings = { ...this.data.settings, ...settings };
    return this;
  }

  build() {
    return {
      name: this.data.name!,
      path: this.data.path!,
      files: this.data.files!,
      settings: this.data.settings!
    };
  }
}

/**
 * Convenient factory functions
 */
export const build = {
  user: () => new UserBuilder(),
  aiMessage: () => new AIMessageBuilder(),
  file: () => new FileBuilder(),
  workspace: () => new WorkspaceBuilder()
};
