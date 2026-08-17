/**
 * Example usage of IPC API in renderer
 */

import { ipc } from './api';

// Example: Read a file
async function exampleReadFile() {
  try {
    const result = await ipc.filesystem.readFile('/path/to/file.txt');
    console.log('File content:', result.content);
    console.log('File size:', result.stats.size);
  } catch (error) {
    console.error('Failed to read file:', error);
  }
}

// Example: Open file in editor
async function exampleOpenFile() {
  try {
    const result = await ipc.editor.openFile('/path/to/code.ts');
    console.log('Language:', result.language);
    console.log('Content:', result.content);
  } catch (error) {
    console.error('Failed to open file:', error);
  }
}

// Example: Git status
async function exampleGitStatus() {
  try {
    const result = await ipc.git.status('/path/to/repo');
    console.log('Branch:', result.branch);
    console.log('Files:', result.files);
  } catch (error) {
    console.error('Failed to get git status:', error);
  }
}

// Example: Create AI session
async function exampleAI() {
  try {
    const session = await ipc.ai.createSession('gpt-4', 'openai');
    console.log('Session created:', session.sessionId);
    
    const response = await ipc.ai.sendMessage(session.sessionId, 'Hello!');
    // The payload field is `content`, not `response`.
    console.log('AI response:', response.content);
  } catch (error) {
    console.error('AI error:', error);
  }
}

// Example: Create terminal
async function exampleTerminal() {
  try {
    const terminal = await ipc.terminal.create('/home/user');
    console.log('Terminal created:', terminal.terminalId);
    
    // Listen to output
    const unsubscribe = ipc.terminal.onData((event) => {
      console.log('Terminal output:', event.data);
    });

    // Send command
    await ipc.terminal.input(terminal.terminalId, 'ls -la\n');

    // Cleanup
    unsubscribe();
  } catch (error) {
    console.error('Terminal error:', error);
  }
}

// Example: Database query
async function exampleDatabase() {
  try {
    const result = await ipc.database.query<{ id: string; name: string }>(
      'SELECT id, name FROM workspaces WHERE id = ?',
      ['workspace-123']
    );
    console.log('Query result:', result.rows);
  } catch (error) {
    console.error('Database error:', error);
  }
}

// Example: File watching
async function exampleFileWatch() {
  const watchId = 'watch-1';
  
  // Start watching
  await ipc.filesystem.watch('/path/to/watch', watchId);
  
  // Listen to changes
  const unsubscribe = ipc.filesystem.onFileChange((event) => {
    if (event.watchId === watchId) {
      console.log('File changed:', event.path, event.event);
    }
  });

  // Stop watching
  await ipc.filesystem.unwatch(watchId);
  unsubscribe();
}

export {
  exampleReadFile,
  exampleOpenFile,
  exampleGitStatus,
  exampleAI,
  exampleTerminal,
  exampleDatabase,
  exampleFileWatch,
};
