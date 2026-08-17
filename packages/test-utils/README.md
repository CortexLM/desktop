# @cortex-ide/test-utils

Comprehensive testing utilities for Cortex IDE.

## Installation

```bash
bun add -d @cortex-ide/test-utils
```

## Features

### Helpers
- **Async utilities**: `waitFor`, `retry`, `sleep`, `flushPromises`
- **File operations**: `createTempDir`, `createTestWorkspace`, `cleanupTempDir`
- **Test context**: Shared state management

### Mocks
- **AI providers**: Mock OpenAI, Anthropic, Grok
- **IPC system**: Full Electron IPC simulation
- **File system**: In-memory FS operations

### Builders
- **Data builders**: User, AI Message, File, Workspace
- Fluent API with chainable methods

### Custom Matchers
- `toBeWithinRange(min, max)`
- `toContainAll(strings[])`
- `toContainItemMatching(predicate)`
- `toThrowWithMessage(message)`
- `toMatchStructure(schema)`
- `toResolveWithin(ms)`
- `toBeOfType(type)`

### Fixtures
Pre-built test data for common scenarios.

## Quick Start

```typescript
import {
  describe,
  it,
  expect,
  build,
  createMockIPC,
  waitFor,
  registerCustomMatchers
} from '@cortex-ide/test-utils';

registerCustomMatchers();

describe('My Feature', () => {
  it('should work', async () => {
    const user = build.user().withAdmin().build();
    const ipc = createMockIPC();
    
    ipc.on('test', (data) => ({ success: true }));
    const result = await ipc.invoke('test', { userId: user.id });
    
    expect(result.success).toBe(true);
  });
});
```

## API Documentation

See main project documentation: `TESTING_IMPROVEMENTS.md`
