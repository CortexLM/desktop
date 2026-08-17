# SimpleAgentManager Documentation

## Overview

`SimpleAgentManager` is a lightweight, in-memory agent session manager designed as a simpler alternative to the mission orchestrator. It provides core functionality for managing multiple concurrent AI agent conversations with full streaming support.

## Features

- ✅ **In-memory session storage** - No external dependencies
- ✅ **Concurrent sessions** - Handle multiple agent conversations simultaneously
- ✅ **Streaming responses** - Full streaming support with async iterators
- ✅ **Session lifecycle** - Create, pause, resume, and cancel sessions
- ✅ **Provider integration** - Works with existing AIProviderRegistry
- ✅ **Conversation history** - Full message history per session
- ✅ **Error handling** - Comprehensive error types and recovery
- ✅ **Cancellation support** - Cancel streaming responses mid-flight

## Installation

```typescript
import { SimpleAgentManager, AIProviderRegistry } from 'ai-engine';

// Initialize registry
const registry = AIProviderRegistry.fromEnv();

// Create manager
const manager = new SimpleAgentManager(registry);
```

## Basic Usage

### Creating a Session

```typescript
const session = await manager.createSession({
  provider: 'openai',
  model: 'gpt-4.5-turbo',
  temperature: 0.7,
  maxTokens: 2000,
  systemPrompt: 'You are a helpful coding assistant.',
  metadata: {
    userId: 'user-123',
    projectId: 'project-456',
  },
});

console.log(session.id); // "session_xyz123_abc456"
console.log(session.status); // "active"
```

### Sending Messages with Streaming

```typescript
// Stream a response
for await (const chunk of manager.sendMessage(session.id, 'Explain TypeScript generics')) {
  process.stdout.write(chunk.content);
  
  if (chunk.done) {
    console.log('\n\nFinished!');
  }
}

// Session history is automatically updated
const updatedSession = manager.getSession(session.id);
console.log(updatedSession.messages);
// [
//   { role: 'system', content: 'You are a helpful coding assistant.' },
//   { role: 'user', content: 'Explain TypeScript generics' },
//   { role: 'assistant', content: '...' }
// ]
```

### Session Management

```typescript
// Pause a session
await manager.pauseSession(session.id);

// Resume later
await manager.resumeSession(session.id);

// Cancel/complete a session
await manager.cancelSession(session.id);

// Delete a session
await manager.deleteSession(session.id);
```

### Listing Sessions

```typescript
// List all sessions
const allSessions = await manager.listSessions();

// Filter by status
const activeSessions = await manager.listSessions('active');
const pausedSessions = await manager.listSessions('paused');
const completedSessions = await manager.listSessions('completed');

// Get session counts
console.log(manager.getSessionCount()); // Total sessions
console.log(manager.getActiveSessionCount()); // Active sessions only
```

## Advanced Usage

### Multi-turn Conversations

```typescript
const session = await manager.createSession({
  provider: 'anthropic',
  model: 'claude-opus-4.8',
  systemPrompt: 'You are a code reviewer.',
});

// First turn
for await (const chunk of manager.sendMessage(session.id, 'Review this code: ...')) {
  // Handle response
}

// Second turn - context is preserved
for await (const chunk of manager.sendMessage(session.id, 'Can you explain the issues?')) {
  // Handle response with full context
}

// Third turn
for await (const chunk of manager.sendMessage(session.id, 'Suggest improvements')) {
  // Handle response
}
```

### Concurrent Sessions

```typescript
// Create multiple sessions
const session1 = await manager.createSession({
  provider: 'openai',
  model: 'gpt-4.5-turbo',
});

const session2 = await manager.createSession({
  provider: 'anthropic',
  model: 'claude-opus-4.8',
});

// Run them concurrently
await Promise.all([
  (async () => {
    for await (const chunk of manager.sendMessage(session1.id, 'Task 1')) {
      console.log('[Session 1]', chunk.content);
    }
  })(),
  (async () => {
    for await (const chunk of manager.sendMessage(session2.id, 'Task 2')) {
      console.log('[Session 2]', chunk.content);
    }
  })(),
]);
```

### Handling Cancellation

```typescript
const session = await manager.createSession({
  provider: 'openai',
  model: 'gpt-4.5-turbo',
});

// Start streaming
const streamPromise = (async () => {
  try {
    for await (const chunk of manager.sendMessage(session.id, 'Long task...')) {
      console.log(chunk.content);
    }
  } catch (error) {
    console.log('Stream was cancelled');
  }
})();

// Cancel after 2 seconds
setTimeout(async () => {
  await manager.pauseSession(session.id);
  console.log('Session paused');
}, 2000);

await streamPromise;
```

### Error Handling

```typescript
import { AgentManagerError } from 'ai-engine';

try {
  const session = await manager.createSession({
    provider: 'nonexistent',
    model: 'model',
  });
} catch (error) {
  if (error instanceof AgentManagerError) {
    console.error('Error code:', error.code);
    console.error('Session ID:', error.sessionId);
    console.error('Message:', error.message);
    
    switch (error.code) {
      case 'PROVIDER_NOT_FOUND':
        // Handle provider not found
        break;
      case 'PROVIDER_UNAVAILABLE':
        // Handle provider unavailable
        break;
      case 'SESSION_NOT_FOUND':
        // Handle session not found
        break;
      case 'SESSION_NOT_ACTIVE':
        // Handle inactive session
        break;
      case 'STREAM_ERROR':
        // Handle streaming error
        break;
    }
  }
}
```

### Custom Metadata

```typescript
const session = await manager.createSession({
  provider: 'openai',
  model: 'gpt-4.5-turbo',
  metadata: {
    userId: 'user-123',
    projectId: 'project-456',
    feature: 'code-review',
    timestamp: Date.now(),
  },
});

// Retrieve metadata later
const retrieved = manager.getSession(session.id);
console.log(retrieved.metadata.userId); // "user-123"
```

## API Reference

### Types

#### `AgentSessionConfig`

```typescript
interface AgentSessionConfig {
  provider: string;          // Provider ID from registry
  model: string;             // Model name
  temperature?: number;      // Temperature (0-1)
  maxTokens?: number;        // Max response tokens
  systemPrompt?: string;     // System prompt
  metadata?: Record<string, unknown>; // Custom metadata
}
```

#### `AgentSession`

```typescript
interface AgentSession {
  id: string;
  messages: Message[];
  status: 'active' | 'paused' | 'completed' | 'failed';
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
  error?: string;
}
```

#### `AgentStreamChunk`

```typescript
interface AgentStreamChunk {
  sessionId: string;
  content: string;
  done: boolean;
  finishReason?: string;
}
```

### Methods

#### `createSession(config: AgentSessionConfig): Promise<AgentSession>`

Creates a new agent session.

**Errors:**
- `PROVIDER_NOT_FOUND` - Provider doesn't exist in registry
- `PROVIDER_UNAVAILABLE` - Provider is not available

#### `sendMessage(sessionId: string, message: string): AsyncIterableIterator<AgentStreamChunk>`

Sends a message and streams the response.

**Errors:**
- `SESSION_NOT_FOUND` - Session doesn't exist
- `SESSION_NOT_ACTIVE` - Session is not active
- `PROVIDER_NOT_FOUND` - Provider no longer available
- `STREAM_ERROR` - Error during streaming

#### `pauseSession(sessionId: string): Promise<void>`

Pauses an active session and cancels any active stream.

**Errors:**
- `SESSION_NOT_FOUND` - Session doesn't exist
- `SESSION_NOT_ACTIVE` - Session is not active

#### `resumeSession(sessionId: string): Promise<void>`

Resumes a paused session.

**Errors:**
- `SESSION_NOT_FOUND` - Session doesn't exist
- `SESSION_NOT_PAUSED` - Session is not paused
- `PROVIDER_NOT_FOUND` - Provider no longer available
- `PROVIDER_UNAVAILABLE` - Provider is not available

#### `cancelSession(sessionId: string): Promise<void>`

Cancels a session (marks as completed).

**Errors:**
- `SESSION_NOT_FOUND` - Session doesn't exist

#### `listSessions(status?: AgentSessionStatus): Promise<AgentSession[]>`

Lists all sessions, optionally filtered by status.

#### `getSession(sessionId: string): AgentSession | undefined`

Gets a specific session by ID.

#### `deleteSession(sessionId: string): Promise<void>`

Deletes a session from memory.

**Errors:**
- `SESSION_NOT_FOUND` - Session doesn't exist

#### `getSessionCount(): number`

Returns total number of sessions.

#### `getActiveSessionCount(): number`

Returns number of active sessions.

#### `clearAllSessions(): Promise<void>`

Clears all sessions from memory.

## Testing

The package includes comprehensive tests with 80%+ coverage:

```bash
npm test -- simple-agent-manager.test.ts
```

Test coverage includes:
- ✅ Session creation and validation
- ✅ Message streaming
- ✅ Session lifecycle (pause/resume/cancel)
- ✅ Concurrent sessions
- ✅ Error handling
- ✅ Stream cancellation
- ✅ Session isolation
- ✅ Provider integration

## Migration from Mission Orchestrator

If you're migrating from the mission orchestrator:

```typescript
// Old: Mission Orchestrator
const orchestrator = new MissionOrchestrator(registry);
const mission = await orchestrator.createMission(...);

// New: SimpleAgentManager
const manager = new SimpleAgentManager(registry);
const session = await manager.createSession({
  provider: 'openai',
  model: 'gpt-4.5-turbo',
});
```

Key differences:
- **Simpler API** - No mission states, features, or complex orchestration
- **Direct streaming** - Async iterator instead of callbacks
- **In-memory only** - No persistence layer
- **Focused scope** - Conversation management only

## Performance Characteristics

- **Memory**: O(n) where n = total message count across all sessions
- **Session creation**: O(1)
- **Message send**: O(m) where m = message history length
- **List sessions**: O(n) where n = session count
- **Concurrent sessions**: No limit (constrained by memory and provider rate limits)

## Best Practices

1. **Clean up sessions** - Delete completed sessions to free memory
2. **Handle errors** - Always wrap in try-catch for robustness
3. **Monitor active sessions** - Use `getActiveSessionCount()` for monitoring
4. **Set reasonable limits** - Configure `maxTokens` to prevent runaway costs
5. **Use metadata** - Store context like user IDs for debugging
6. **Test streaming** - Always test streaming cancellation logic

## Examples

See the `examples/` directory for complete working examples:
- `basic-usage.ts` - Simple conversation
- `concurrent-sessions.ts` - Multiple simultaneous sessions
- `streaming-demo.ts` - Advanced streaming patterns
- `error-handling.ts` - Comprehensive error handling

## License

MIT
