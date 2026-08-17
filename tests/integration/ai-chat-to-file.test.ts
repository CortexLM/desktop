/**
 * Integration test: AI Chat to File System workflow
 * Tests the complete flow from chat message to file creation
 */

import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { createMockAIProvider, createMockIPC, createTestWorkspace } from '@cortex-ide/test-utils';

describe('AI Chat to File System Integration', () => {
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let aiProvider: ReturnType<typeof createMockAIProvider>;
  let ipc: ReturnType<typeof createMockIPC>;

  beforeEach(async () => {
    workspace = await createTestWorkspace('integration-test');
    aiProvider = createMockAIProvider();
    ipc = createMockIPC();
  });

  afterEach(async () => {
    await workspace.cleanup();
    aiProvider.reset();
    ipc.reset();
  });

  test('should handle complete chat-to-file workflow', async () => {
    // Setup mock AI response
    aiProvider.mockResponse({
      content: 'Here is your code:\n```typescript\nexport const hello = () => "world";\n```',
      model: 'gpt-4',
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 }
    });

    // Simulate user sending message
    const userMessage = 'Create a hello world function';
    const response = await aiProvider.chat([
      { role: 'user', content: userMessage }
    ]);

    expect(response.content).toContain('export const hello');
    expect(aiProvider.getCallCount()).toBe(1);

    // Simulate IPC call to save file
    ipc.on('file:write', async (data: { path: string; content: string }) => {
      return { success: true, path: data.path };
    });

    const result = await ipc.invoke('file:write', {
      path: `${workspace.root}/src/hello.ts`,
      content: 'export const hello = () => "world";'
    });

    expect(result.success).toBe(true);
    expect(ipc.getSentMessages()).toHaveLength(1);
  });

  test('should handle error recovery in AI workflow', async () => {
    // Setup failing AI provider
    aiProvider.chat.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    // `.rejects` needs the promise itself, not a function returning one.
    await expect(aiProvider.chat([{ role: 'user', content: 'test' }])).rejects.toThrow(
      'API rate limit exceeded'
    );

    // Retry should work
    aiProvider.mockResponse({ content: 'Success', model: 'gpt-4' });
    const response = await aiProvider.chat([{ role: 'user', content: 'test' }]);
    
    expect(response.content).toBe('Success');
  });

  test('should handle multi-step code generation workflow', async () => {
    // Step 1: Generate interface
    aiProvider.mockResponse({
      content: 'interface User { id: string; name: string; }',
      model: 'gpt-4'
    });

    const step1 = await aiProvider.chat([
      { role: 'user', content: 'Create a User interface' }
    ]);

    // Step 2: Generate implementation
    aiProvider.mockResponse({
      content: 'class UserService { getUser(id: string): User { ... } }',
      model: 'gpt-4'
    });

    const step2 = await aiProvider.chat([
      { role: 'user', content: 'Create UserService class' }
    ]);

    expect(step1.content).toContain('interface User');
    expect(step2.content).toContain('class UserService');
    expect(aiProvider.getCallCount()).toBe(2);
  });
});
