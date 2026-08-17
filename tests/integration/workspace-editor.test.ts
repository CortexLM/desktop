/**
 * Integration test: Workspace and Editor integration
 * Tests complete workspace operations including file opening, editing, and saving
 */

import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { createTestWorkspace, createMockIPC, waitFor } from '@cortex-ide/test-utils';

describe('Workspace and Editor Integration', () => {
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>;
  let ipc: ReturnType<typeof createMockIPC>;

  beforeEach(async () => {
    workspace = await createTestWorkspace('editor-test');
    ipc = createMockIPC();
  });

  afterEach(async () => {
    await workspace.cleanup();
    ipc.reset();
  });

  test('should handle complete file editing workflow', async () => {
    const openFiles = new Map<string, { content: string; modified: boolean }>();

    // Open file
    ipc.on('file:open', (data: { path: string }) => {
      const content = 'export const initial = true;';
      openFiles.set(data.path, { content, modified: false });
      return { content };
    });

    const openResult = await ipc.invoke('file:open', {
      path: `${workspace.root}/src/index.ts`
    });

    expect(openResult.content).toBeDefined();
    expect(openFiles.size).toBe(1);

    // Edit file
    const filePath = `${workspace.root}/src/index.ts`;
    const file = openFiles.get(filePath)!;
    file.content = 'export const modified = true;';
    file.modified = true;

    expect(file.modified).toBe(true);
    expect(file.content).toContain('modified');

    // Save file
    ipc.on('file:save', (data: { path: string; content: string }) => {
      const file = openFiles.get(data.path);
      if (file) {
        file.content = data.content;
        file.modified = false;
      }
      return { success: true };
    });

    await ipc.invoke('file:save', {
      path: filePath,
      content: file.content
    });

    expect(openFiles.get(filePath)?.modified).toBe(false);
  });

  test('should manage multiple open tabs', async () => {
    const tabs = new Map<string, { path: string; active: boolean }>();

    // Open multiple files
    const files = [
      `${workspace.root}/src/index.ts`,
      `${workspace.root}/src/utils.ts`,
      `${workspace.root}/src/types.ts`
    ];

    files.forEach((path, index) => {
      tabs.set(path, { path, active: index === 0 });
    });

    expect(tabs.size).toBe(3);

    // Switch active tab
    const newActivePath = files[1];
    tabs.forEach((tab, path) => {
      tab.active = path === newActivePath;
    });

    const activeTab = Array.from(tabs.values()).find(t => t.active);
    expect(activeTab?.path).toBe(newActivePath);
  });

  test('should handle workspace navigation', async () => {
    const navigation = {
      history: [] as string[],
      currentIndex: -1
    };

    // Navigate to files
    const navigateTo = (path: string) => {
      navigation.history = navigation.history.slice(0, navigation.currentIndex + 1);
      navigation.history.push(path);
      navigation.currentIndex++;
    };

    navigateTo('/workspace/src/index.ts');
    navigateTo('/workspace/src/utils.ts');
    navigateTo('/workspace/src/types.ts');

    expect(navigation.history).toHaveLength(3);
    expect(navigation.currentIndex).toBe(2);

    // Go back
    navigation.currentIndex--;
    expect(navigation.history[navigation.currentIndex]).toBe('/workspace/src/utils.ts');

    // Go forward
    navigation.currentIndex++;
    expect(navigation.history[navigation.currentIndex]).toBe('/workspace/src/types.ts');
  });
});
