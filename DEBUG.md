# Cortex IDE - Debug Mode Documentation

## Overview

Cortex IDE includes a comprehensive debug mode system that provides deep insights into application behavior, performance, and issues. This document describes all available debugging tools and features.

## Table of Contents

1. [Enabling Debug Mode](#enabling-debug-mode)
2. [Debug Panel](#debug-panel)
3. [Logging System](#logging-system)
4. [IPC Inspector](#ipc-inspector)
5. [Performance Monitor](#performance-monitor)
6. [Memory Profiler](#memory-profiler)
7. [Error Reporting](#error-reporting)
8. [Developer Tools](#developer-tools)
9. [Configuration](#configuration)

---

## Enabling Debug Mode

### Via Environment Variable

Set the `DEBUG` environment variable before launching:

```bash
DEBUG=true npm run dev
# or
DEBUG=true cortex-ide
```

### Via UI

Click the **Debug Mode** toggle in the application header to enable/disable debug mode at runtime.

### Via Settings

Navigate to Debug Panel → Settings tab to configure debug behavior.

---

## Debug Panel

### Opening the Debug Panel

- **Keyboard Shortcut**: `Cmd+Shift+D` (macOS) or `Ctrl+Shift+D` (Windows/Linux)
- **UI Toggle**: Click "Debug Panel" button in the header (when debug mode is enabled)

### Panel Tabs

#### 1. Console

Real-time log viewer showing all messages from both main and renderer processes.

**Features:**
- **Search**: Filter logs by message content or category
- **Level Filter**: Show only specific log levels (debug, info, warn, error)
- **Source Filter**: Filter by process (main or renderer)
- **Auto-scroll**: Automatically scroll to latest logs
- **Stack Traces**: Expandable error stack traces
- **JSON Data**: Formatted display of log metadata

**Keyboard Shortcuts:**
- `Cmd/Ctrl+F`: Focus search
- `Cmd/Ctrl+K`: Clear logs

#### 2. IPC Inspector

Monitor all Inter-Process Communication messages in real-time.

**Features:**
- **Message List**: All IPC messages with timestamps and direction
- **Channel Filter**: Search for specific IPC channels
- **Direction Filter**: Filter by message direction (renderer→main or main→renderer)
- **Timing Info**: Request/response duration tracking
- **Data Inspection**: Expandable JSON payloads
- **Channel Statistics**: Aggregate metrics per channel

**Useful For:**
- Debugging IPC communication issues
- Identifying slow IPC handlers
- Understanding data flow between processes

#### 3. Performance

Real-time performance metrics and timing information.

**Features:**
- **Live Charts**: Line graphs of performance metrics over time
- **Category Selection**: Filter metrics by category (timing, memory, CPU, etc.)
- **Statistics**: Min, max, avg, and count for each metric
- **Custom Metrics**: Record your own performance markers

**Metric Categories:**
- `timing`: Operation durations (IPC calls, file operations, etc.)
- `memory`: Heap usage, RSS, external memory
- `cpu`: CPU usage by process type
- `app`: Application-level metrics

**Example Usage:**

```typescript
import { performanceMonitor } from '@cortex-ide/shared';

// Mark operation start
const done = performanceMonitor.markStart('myOperation');

// ... do work ...

// Record duration
done(); // Automatically records metric
```

#### 4. Memory

Memory usage visualization and profiling.

**Features:**
- **Live Charts**: Real-time memory usage graphs
- **Current Metrics**: Latest heap, RSS, and external memory values
- **Heap Utilization**: Percentage of heap in use
- **System Info**: Platform, architecture, and runtime versions

**Memory Types:**
- **Heap Used**: JavaScript heap memory actively used
- **Heap Total**: Total allocated JavaScript heap
- **External**: Memory used by C++ objects bound to JavaScript
- **RSS**: Resident Set Size (total process memory)

#### 5. Settings

Configure debug mode behavior and view system information.

**Configuration Options:**
- **Enable Debug Mode**: Master toggle for debug features
- **Log Level**: Minimum severity level to record (debug, info, warn, error)
- **Max Log Size**: Maximum log file size in MB before rotation
- **Log Rotation**: Automatically rotate and clean old log files
- **Category Toggles**: Enable/disable logging per category

**Categories:**
- `ipc`: IPC communication logs
- `performance`: Performance metrics
- `network`: Network requests (future)
- `database`: Database queries (future)
- `ai`: AI service logs
- `git`: Git operations

---

## Logging System

### Logger API

The structured logging system is available in both main and renderer processes.

```typescript
import { logger } from '@cortex-ide/shared/logger';

// Log levels
logger.debug('category', 'Debug message', { data: 'optional' });
logger.info('category', 'Info message', { data: 'optional' });
logger.warn('category', 'Warning message', { data: 'optional' });
logger.error('category', 'Error message', errorObject);
```

### Log Format

```typescript
interface LogEntry {
  id: string;              // Unique log ID
  timestamp: number;       // Unix timestamp in ms
  level: LogLevel;         // debug | info | warn | error
  category: string;        // Log category
  message: string;         // Log message
  data?: any;             // Optional structured data
  stack?: string;         // Stack trace (for errors)
  source: 'main' | 'renderer';
}
```

### Categories

Use meaningful categories to organize logs:

- `ipc`: Inter-process communication
- `git`: Git operations
- `ai`: AI service interactions
- `file`: File system operations
- `terminal`: Terminal/shell operations
- `automation`: Automation workflows
- `ui`: UI interactions
- `performance`: Performance tracking
- Custom categories as needed

### Log Files

Logs are automatically written to disk:

**Location**: `~/.cortex-ide/logs/`

**File Format**: `cortex-ide-YYYY-MM-DD.log`

**Rotation**: Automatically rotates when exceeding max size (default 10MB)

**Retention**: Keeps last 10 log files

---

## IPC Inspector

### Monitoring IPC Messages

All IPC communication is automatically tracked when debug mode is enabled.

### Message Structure

```typescript
interface IPCMessage {
  id: string;
  timestamp: number;
  channel: string;
  direction: 'main->renderer' | 'renderer->main';
  data: any;
  duration?: number; // ms (for request/response)
}
```

### Performance Analysis

Use the channel statistics to identify:
- **High-frequency channels**: May indicate inefficient communication patterns
- **Slow channels**: IPC handlers that need optimization
- **Failed requests**: Channels with errors

---

## Performance Monitor

### Recording Custom Metrics

```typescript
import { performanceMonitor } from '@cortex-ide/main/services/performance-monitor';

// Simple timing
const done = performanceMonitor.markStart('operation-name');
// ... work ...
done();

// Custom metric
performanceMonitor.recordMetric('category', 'metricName', value, 'unit');
```

### Metric Categories

- `timing`: Duration measurements
- `memory`: Memory snapshots
- `cpu`: CPU usage
- `app`: Application metrics
- Custom categories

### Accessing Metrics

```typescript
// Get metrics by category
const metrics = await window.electron.invoke('debug:get-metrics', 'timing', 100);

// Get statistics for a specific metric
const stats = await window.electron.invoke('debug:get-metric-stats', 'timing', 'ipc-call');
// Returns: { min, max, avg, count }
```

---

## Memory Profiler

### Memory Snapshots

Automatically collected every 5 seconds when debug mode is enabled.

```typescript
interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;    // Bytes
  heapTotal: number;   // Bytes
  external: number;    // Bytes
  rss: number;        // Bytes (Resident Set Size)
}
```

### Accessing Memory Data

```typescript
// Get recent memory snapshots
const snapshots = await window.electron.invoke('debug:get-memory', 100);
```

### Interpreting Memory Metrics

- **Heap Used**: Actual JavaScript memory in use
- **Heap Total**: Allocated heap (may be larger than used)
- **External**: C++ objects bound to JavaScript
- **RSS**: Total process memory (includes code, stack, heap)

**Warning Signs:**
- Continuously increasing heap usage → memory leak
- High RSS with low heap → potential native memory issue

---

## Error Reporting

### Automatic Error Capture

All unhandled errors are automatically captured:

- Window errors (`window.onerror`)
- Unhandled promise rejections (`unhandledrejection`)
- React component errors (Error Boundary)

### Manual Error Reporting

```typescript
import { reportError } from '@cortex-ide/renderer/utils/error-handlers';

try {
  // risky operation
} catch (error) {
  reportError(error, {
    context: 'user-action',
    additionalData: 'anything useful'
  }, 'high'); // severity: low | medium | high | critical
}
```

### Error Report Structure

```typescript
interface ErrorReport {
  id: string;
  timestamp: number;
  message: string;
  stack: string;
  componentStack?: string;  // React component stack
  source: 'main' | 'renderer';
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

### React Error Boundary

Wraps the entire application to catch React component errors:

```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**Features:**
- User-friendly error display
- Copy error details to clipboard
- Reset application state
- Automatic error logging

---

## Developer Tools

### Chrome DevTools

Access full Chrome DevTools for advanced debugging:

**Open DevTools:**
- Press `F12`
- Or `Cmd+Option+I` (macOS)
- Or `Ctrl+Shift+I` (Windows/Linux)

**Features:**
- JavaScript debugging with breakpoints
- Network inspector
- React DevTools (if installed)
- Performance profiling
- Memory heap snapshots
- Console for direct script execution

### Source Maps

Source maps are enabled in development mode for debugging TypeScript source code.

---

## Configuration

### Settings API

```typescript
import { DebugSettings } from '@cortex-ide/shared/types/debug';

// Get current settings
const settings = await window.electron.invoke('debug:get-settings');

// Update settings
await window.electron.invoke('debug:update-settings', {
  enabled: true,
  logLevel: 'debug',
  categories: {
    ipc: true,
    performance: true,
    // ...
  }
});
```

### Environment Variables

- `DEBUG=true`: Enable debug mode on startup
- `NODE_ENV=development`: Development mode with source maps

### Persistence

Debug settings are persisted to:
- Debug Panel visibility: `localStorage`
- Debug configuration: Application settings

---

## Best Practices

### 1. Use Appropriate Log Levels

- **debug**: Detailed diagnostic information
- **info**: General informational messages
- **warn**: Warning messages for potential issues
- **error**: Error events that need attention

### 2. Structure Log Data

Always include relevant context:

```typescript
logger.info('git', 'Repository cloned', {
  url: repoUrl,
  branch: branchName,
  duration: elapsedMs
});
```

### 3. Use Categories Consistently

Define standard categories for your domain:
- Keep categories short and descriptive
- Use a consistent naming convention
- Document custom categories

### 4. Performance Monitoring

Only measure what matters:
- Focus on user-visible operations
- Track operations that cross process boundaries
- Monitor resource-intensive tasks

### 5. Error Context

Provide useful context when reporting errors:
- User action that triggered the error
- Application state
- Relevant IDs or paths

---

## Troubleshooting

### Debug Panel Not Showing

1. Ensure debug mode is enabled
2. Try keyboard shortcut: `Cmd/Ctrl+Shift+D`
3. Check browser console for errors

### Logs Not Appearing

1. Check log level filter
2. Verify category is enabled in settings
3. Ensure debug mode is enabled

### IPC Messages Missing

1. Confirm debug mode is active before IPC calls
2. Check IPC monitor initialization in main process

### Performance Data Not Updating

1. Verify performance monitoring is started
2. Check if data collection interval is appropriate
3. Look for errors in console

---

## Exporting Data

### Export Logs

Click the **Export** button (download icon) in the Debug Panel header to export all logs to a JSON file.

**Programmatic Export:**

```typescript
const result = await window.electron.invoke('debug:export-logs');
// result.path contains the saved file path
```

### Log File Location

Direct access to log files:

```bash
# macOS
~/Library/Application Support/cortex-ide/logs/

# Linux
~/.config/cortex-ide/logs/

# Windows
%APPDATA%/cortex-ide/logs/
```

---

## Advanced Usage

### Custom Performance Markers

```typescript
import { performanceMonitor } from '@cortex-ide/main/services/performance-monitor';

// Start monitoring
performanceMonitor.start();

// Record custom metrics
performanceMonitor.recordMetric('custom', 'api-latency', latencyMs, 'ms');

// Get statistics
const stats = performanceMonitor.getMetricStats('custom', 'api-latency');
console.log(`Avg API latency: ${stats.avg}ms`);
```

### Programmatic Log Filtering

```typescript
// Filter logs
const errorLogs = await window.electron.invoke('debug:filter-logs', {
  level: 'error',
  category: 'git',
  since: Date.now() - 3600000 // Last hour
});
```

---

## Security Considerations

- Log files may contain sensitive information
- Disable debug mode in production builds
- Review logs before sharing
- Use log rotation to prevent disk space issues
- Consider implementing log sanitization for PII

---

## Support

For issues or questions about debug features:

1. Check this documentation
2. Review logs in `~/.cortex-ide/logs/`
3. Use the Debug Panel to investigate
4. Report bugs with exported log files

---

**Version**: 0.1.0  
**Last Updated**: 2026-08-16
