# Quick Start - Debug Mode

## Activation

### Option 1: Environment Variable (Recommended for Development)

```bash
# Launch with debug mode enabled
DEBUG=true npm run dev
```

### Option 2: In-App Toggle

Click the "🐛 Debug: OFF" button in the header to enable debug mode.

## Opening the Debug Panel

**Keyboard Shortcut**: `Cmd+Shift+D` (macOS) or `Ctrl+Shift+D` (Windows/Linux)

**Or**: Click "Debug Panel" button when debug mode is enabled

## Quick Examples

### 1. Viewing Logs

```typescript
import { logger } from '@cortex-ide/shared/logger';

// Log with different levels
logger.debug('myFeature', 'Detailed debug info', { userId: 123 });
logger.info('myFeature', 'User logged in', { email: 'user@example.com' });
logger.warn('myFeature', 'Deprecation warning');
logger.error('myFeature', 'Failed to save', error);
```

**View in**: Debug Panel → Console tab

### 2. Monitoring IPC Performance

```typescript
// Your IPC calls are automatically monitored
const result = await window.cortex.git.status({ repoPath: '/path' });

// View in: Debug Panel → IPC Inspector tab
// Shows: timing, payload size, frequency
```

### 3. Tracking Performance

```typescript
import { performanceMonitor } from '@cortex-ide/main/services/performance-monitor';

// Start an operation
const done = performanceMonitor.markStart('loadWorkspace');

// ... do work ...

// Automatically record duration
done();

// View in: Debug Panel → Performance tab
```

### 4. Memory Profiling

Memory snapshots are automatically collected every 5 seconds.

**View in**: Debug Panel → Memory tab

**Look for**:
- Continuously rising heap → memory leak
- Sudden spikes → investigate what triggered it

### 5. Error Reporting

```typescript
import { reportError } from '@cortex-ide/renderer/utils/error-handlers';

try {
  await riskyOperation();
} catch (error) {
  reportError(error, {
    operation: 'riskyOperation',
    context: { userId: 123 }
  }, 'high');
}
```

**All unhandled errors are automatically captured!**

## Keyboard Shortcuts

- `Cmd/Ctrl+Shift+D` - Toggle Debug Panel
- `F12` - Open Chrome DevTools
- `Cmd/Ctrl+K` - Clear console (in Console tab)

## Export Logs

Click the download icon in Debug Panel header to export all logs as JSON.

**Logs location**: `~/.cortex-ide/logs/`

## See Also

Read the full [DEBUG.md](./DEBUG.md) documentation for comprehensive details.
