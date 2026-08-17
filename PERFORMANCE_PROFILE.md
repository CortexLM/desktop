# 🚀 PERFORMANCE PROFILE - Cortex IDE

**Date**: 2026-08-16  
**Version**: 0.1.0  
**Environment**: Electron 32.3.3 + React + Vite

---

## 📊 EXECUTIVE SUMMARY

### Critical Findings
- ⚠️ **Bundle Size**: Main renderer bundle is 648KB (196KB gzipped) - exceeds recommended 500KB threshold
- ✅ **Code Splitting**: Vendor chunks properly separated (React, UI components)
- ⚠️ **Source Maps**: 4.7MB of source maps in production build
- ✅ **Performance Infrastructure**: Comprehensive monitoring already in place
- 💡 **Optimization Potential**: 30-40% improvement possible with recommended changes

### Overall Health Score: 7.5/10

---

## 🔥 1. STARTUP PERFORMANCE

### Critical Path Analysis

#### Phase Breakdown (Estimated)
```
┌─────────────────────────────────────────────────────────────┐
│ Electron Launch         [████░░░░░░] ~800ms                 │
│ Main Process Init       [███░░░░░░░] ~600ms                 │
│ Window Creation         [██░░░░░░░░] ~400ms                 │
│ Renderer Bundle Load    [██████░░░░] ~1200ms                │
│ React Hydration         [████░░░░░░] ~800ms                 │
│ First Meaningful Paint  [████████░░] ~1600ms                │
└─────────────────────────────────────────────────────────────┘
Total Estimated Startup: ~3.8 seconds
```

### 🎯 Startup Bottlenecks Identified

#### 1. **Main Process Initialization** (600ms)
**Location**: `packages/main/src/index.ts`

**Issues**:
- Synchronous initialization of all services
- Performance monitoring starts immediately
- Database connection established during startup
- All IPC handlers registered upfront

**Current Code**:
```typescript
app.whenReady().then(async () => {
  initializeSecurity();                    // ~50ms
  await initializePerformance({...});      // ~150ms
  await debugService.initialize();         // ~100ms
  ipcMonitor.initialize();                 // ~50ms
  registerIPCHandlers();                   // ~200ms
  setupAutomationEvents();                 // ~50ms
  createWindow();                          // ~400ms
});
```

**💡 Optimization Recommendations**:
```typescript
// ✅ OPTIMIZED: Defer non-critical initialization
app.whenReady().then(async () => {
  initializeSecurity();                    // Critical - keep
  
  // Defer performance monitoring until after window shown
  createWindow();                          // Move up - show UI first
  
  // Initialize in background after window is visible
  setImmediate(async () => {
    await initializePerformance({...});
    await debugService.initialize();
    ipcMonitor.initialize();
    setupAutomationEvents();
  });
  
  // Lazy register IPC handlers
  registerCriticalIPCHandlers();           // Only critical ones
  
  // Register remaining handlers after 100ms
  setTimeout(() => registerRemainingIPCHandlers(), 100);
});
```

**Expected Improvement**: 300-400ms reduction in startup time

---

#### 2. **Bundle Loading** (1200ms)
**Location**: `packages/renderer/dist/assets/`

**Issues**:
- Main bundle: 648KB (196KB gzipped)
- Includes heavy dependencies: Prism.js, DOMPurify, Monaco Editor
- No route-based code splitting
- All components loaded upfront

**Current Bundle Composition**:
```
index-FJ-BbJzf.js (648KB):
  ├─ React core (~40KB)
  ├─ Prism.js + languages (~120KB) ⚠️
  ├─ DOMPurify (~25KB)
  ├─ Monaco Editor loader (~60KB) ⚠️
  ├─ Lucide icons (~80KB) ⚠️
  ├─ Application code (~200KB)
  └─ Dependencies (~123KB)
```

**💡 Optimization Strategy**:

1. **Lazy Load Syntax Highlighting**:
```typescript
// ❌ BEFORE: ChatView.tsx
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';

// ✅ AFTER: Lazy load when code block appears
const highlightCode = async (code: string, language: string) => {
  const Prism = await import('prismjs');
  await import(`prismjs/components/prism-${language}`);
  return Prism.highlight(code, Prism.languages[language], language);
};
```

2. **Route-Based Code Splitting**:
```typescript
// ✅ vite.config.ts - Add manual chunks
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react', 'class-variance-authority'],
          'syntax-highlighting': ['prismjs', 'react-syntax-highlighter'],
          'monaco': ['@monaco-editor/react'],
          'markdown': ['react-markdown', 'remark-gfm']
        }
      }
    }
  }
});
```

3. **Lazy Load Heavy Views**:
```typescript
// ✅ App.tsx
const ChatView = lazy(() => import('./views/agents/ChatView'));
const TerminalView = lazy(() => import('./views/terminal/TerminalView'));
const SettingsView = lazy(() => import('./views/settings/SettingsView'));

// Wrap in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <ChatView />
</Suspense>
```

**Expected Improvement**: 
- Initial bundle: 648KB → 280KB (57% reduction)
- First paint: 1600ms → 800ms (50% faster)

---

## ⚡ 2. RUNTIME PERFORMANCE

### React Component Analysis

#### 🔴 High-Priority Issues

##### 1. **ChatView Re-renders** (CRITICAL)
**Location**: `packages/renderer/src/views/agents/ChatView.tsx`

**Problem**: Component re-renders on every message update, causing syntax highlighting to re-run.

**Current Code**:
```typescript
export const ChatView: React.FC<ChatViewProps> = ({ sessionId, model }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  
  // ❌ Re-renders entire list on every message
  return (
    <div>
      {messages.map(msg => (
        <MessageItem key={msg.id} message={msg} />  // Re-highlights on every render
      ))}
    </div>
  );
};
```

**Impact**: 
- ~150ms per re-render with 20 messages
- Blocks UI during streaming
- Causes janky scroll

**💡 Solution**:
```typescript
// ✅ Memoize message items
const MessageItem = React.memo(({ message }: { message: Message }) => {
  const highlightedContent = useMemo(() => {
    if (message.content.includes('```')) {
      return highlightCodeBlocks(message.content);
    }
    return message.content;
  }, [message.content]);
  
  return <div>{highlightedContent}</div>;
}, (prev, next) => {
  // Only re-render if content or streaming status changes
  return prev.message.content === next.message.content &&
         prev.message.isStreaming === next.message.isStreaming;
});

// ✅ Virtualize long message lists
import { useVirtualizer } from '@tanstack/react-virtual';

const messagesVirtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 100,
  overscan: 5
});
```

**Expected Improvement**: 150ms → 5ms per update (97% faster)

---

##### 2. **Syntax Highlighting Performance**
**Location**: `ChatView.tsx:13-20`

**Problem**: Prism.js highlights synchronously, blocking the main thread.

**Current**: Synchronous highlighting on render
```typescript
// ❌ Blocks main thread
const highlighted = Prism.highlight(code, language);
```

**💡 Solution**: Web Worker-based highlighting
```typescript
// ✅ highlight-worker.ts
self.onmessage = async (e) => {
  const { code, language } = e.data;
  const Prism = await import('prismjs');
  await import(`prismjs/components/prism-${language}`);
  const result = Prism.highlight(code, Prism.languages[language], language);
  self.postMessage({ result });
};

// ✅ Use worker in ChatView
const highlightWorker = new Worker(new URL('./highlight-worker.ts', import.meta.url));

const highlightCode = (code: string, language: string): Promise<string> => {
  return new Promise((resolve) => {
    highlightWorker.postMessage({ code, language });
    highlightWorker.onmessage = (e) => resolve(e.data.result);
  });
};
```

**Expected Improvement**: Non-blocking + 60fps maintained

---

#### 🟡 Medium-Priority Optimizations

##### 3. **Auto-scroll Performance**
```typescript
// ❌ BEFORE: Triggers on every message
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

// ✅ AFTER: Debounce and only scroll if user is at bottom
const isAtBottom = useRef(true);
const debouncedScroll = useMemo(
  () => debounce(() => {
    if (isAtBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100),
  []
);

useEffect(() => {
  debouncedScroll();
}, [messages]);
```

---

### Memory Leak Detection

#### Potential Leaks Identified

1. **AbortController not cleaned up**
```typescript
// ❌ BEFORE
const abortControllerRef = useRef<AbortController | null>(null);

// ✅ AFTER: Clean up on unmount
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);
```

2. **Event listeners in IPC**
```typescript
// ✅ Ensure cleanup in main process
app.on('before-quit', async () => {
  unregisterIPCHandlers();  // Already implemented ✅
  await automationService.cleanup();
});
```

---

## 📦 3. BUNDLE ANALYSIS

### Current State

```
┌─────────────────────────────────────────────────────────┐
│ PRODUCTION BUILD SIZE                                   │
├─────────────────────────────────────────────────────────┤
│ Total:        5.63 MB  (1.30 MB gzipped)                │
│ JavaScript:   1.14 MB  (286 KB gzipped)                 │
│ CSS:          5.45 KB  (1.34 KB gzipped)                │
│ Source Maps:  4.48 MB  (977 KB gzipped) ⚠️              │
└─────────────────────────────────────────────────────────┘
```

### Breakdown by Package

#### Renderer (848KB JS)
- `index-FJ-BbJzf.js`: 648KB (196KB gzipped) ⚠️
- `vendor-react-DdXWdMVC.js`: 141KB (46KB gzipped) ✅
- `vendor-ui-_5_x5RR0.js`: 29KB (9KB gzipped) ✅
- `index-CIjyzAso.css`: 5.6KB (1.3KB gzipped) ✅

#### Main Process (233KB)
- `index.js`: 233KB (45KB gzipped) ✅

#### Preload (129KB)
- `index.cjs`: 129KB (21KB gzipped) ✅

### 🎯 Bundle Optimization Plan

#### 1. Remove Source Maps from Production
```javascript
// vite.config.ts
export default defineConfig({
  build: {
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,
    // Or use 'hidden' to generate but not reference in code
    // sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
  }
});
```
**Savings**: 4.48MB → 0MB (100% reduction in production)

#### 2. Implement Tree Shaking for Icons
```typescript
// ❌ BEFORE: Imports all Lucide icons
import * as Icons from 'lucide-react';

// ✅ AFTER: Import only used icons
import { Send, User, Sparkles, StopCircle } from 'lucide-react';
```
**Estimated Savings**: ~40KB

#### 3. Code Splitting Strategy
```
BEFORE:                      AFTER:
┌─────────────────┐          ┌──────────────┐
│ index.js        │          │ index.js     │
│ 648KB           │    →     │ 280KB        │
│                 │          ├──────────────┤
│ Everything      │          │ Lazy Chunks: │
└─────────────────┘          │ - chat.js    │ 150KB
                             │ - terminal.js│ 120KB
                             │ - syntax.js  │ 98KB
                             └──────────────┘
```

#### 4. Optimize Dependencies

**Candidates for Replacement**:
- `dompurify` (25KB) → Use built-in sanitization or lighter alternative
- Full Prism.js → Only load needed languages dynamically
- Consider `react-markdown` alternatives if lighter options exist

---

## 🗄️ 4. DATABASE PERFORMANCE

### SQLite Optimization Status

#### ✅ Already Optimized
```typescript
// packages/main/src/performance/database-optimizer.ts
db.pragma('journal_mode = WAL');           // ✅ Write-Ahead Logging
db.pragma('synchronous = NORMAL');         // ✅ Balanced durability
db.pragma('cache_size = -64000');          // ✅ 64MB cache
db.pragma('temp_store = MEMORY');          // ✅ In-memory temp
db.pragma('mmap_size = 30000000000');      // ✅ 30GB mmap
```

#### Indexes Present
```sql
-- ✅ Key indexes already created
idx_sessions_created_at
idx_sessions_model
idx_messages_session_id
idx_messages_created_at
idx_automations_enabled
idx_executions_automation_id
```

### 🎯 Additional Optimizations

#### 1. Prepared Statement Caching
**Status**: ✅ Implemented in `database-optimizer.ts`
```typescript
const stmt = dbOptimizer.getPreparedStatement(db, sql);
// Cache size: 200 statements
```

#### 2. Batch Operations
**Status**: ✅ Implemented
```typescript
dbOptimizer.startBatch();
// ... multiple operations
dbOptimizer.executeBatch(db);  // Single transaction
```

#### 3. Query Performance Recommendations

**Common Query Patterns to Optimize**:

```sql
-- ❌ SLOW: SELECT * loads unnecessary data
SELECT * FROM ai_messages WHERE session_id = ?;

-- ✅ FAST: Select only needed columns
SELECT id, role, content, created_at 
FROM ai_messages 
WHERE session_id = ? 
ORDER BY created_at;
```

```sql
-- ❌ SLOW: N+1 query pattern
-- In loop: SELECT * FROM ai_messages WHERE session_id = ?

-- ✅ FAST: Single query with JOIN
SELECT s.*, m.id, m.content, m.created_at
FROM ai_sessions s
LEFT JOIN ai_messages m ON m.session_id = s.id
WHERE s.id IN (?, ?, ?, ...)
ORDER BY m.created_at;
```

#### 4. Monitoring Slow Queries
```typescript
// ✅ Already implemented in profiler.ts
profiler.measure('database:query', 'database', async () => {
  return db.prepare(sql).all(params);
});

// Emits 'metric:slow' event for queries > 100ms
profiler.on('metric:slow', (metric) => {
  logger.warn('Slow query detected', { metric });
});
```

---

## ⚡ 5. IPC LATENCY ANALYSIS

### Theoretical Overhead

```
┌────────────────────────────────────────────────────┐
│ IPC ROUND-TRIP BREAKDOWN                           │
├────────────────────────────────────────────────────┤
│ Serialization (renderer):    ~1-3ms                │
│ Context switch:               ~1-2ms                │
│ Handler execution (main):     varies                │
│ Response serialization:       ~1-3ms                │
│ Context switch back:          ~1-2ms                │
├────────────────────────────────────────────────────┤
│ Minimum overhead:             ~5-10ms               │
└────────────────────────────────────────────────────┘
```

### Expected Performance by Channel

| Channel | Expected Latency | Acceptable? |
|---------|-----------------|-------------|
| `db:query` | 5-15ms | ✅ Excellent |
| `git:status` | 30-100ms | ✅ Good (I/O bound) |
| `ai:stream` | 100-300ms | ✅ Good (network bound) |
| `terminal:create` | 20-50ms | ✅ Good |
| `file:read` | 5-20ms | ✅ Excellent |

### 🎯 IPC Optimization Strategies

#### 1. Batching Small Requests
```typescript
// ❌ BEFORE: Multiple IPC calls
const session = await window.cortex.db.query('SELECT ...');
const messages = await window.cortex.db.query('SELECT ...');
const user = await window.cortex.db.query('SELECT ...');

// ✅ AFTER: Single batched call
const results = await window.cortex.db.batch([
  { query: 'SELECT ...', params: [] },
  { query: 'SELECT ...', params: [] },
  { query: 'SELECT ...', params: [] }
]);
```

**Savings**: 30ms → 10ms (3x faster)

#### 2. Caching in Renderer
```typescript
// ✅ Cache rarely-changing data
const useUserSettings = () => {
  const [settings, setSettings] = useState(null);
  
  useEffect(() => {
    const cached = sessionStorage.getItem('userSettings');
    if (cached) {
      setSettings(JSON.parse(cached));
    } else {
      loadSettings();
    }
  }, []);
  
  return settings;
};
```

#### 3. IPC Optimizer Already Implemented
```typescript
// ✅ packages/main/src/performance/ipc-optimizer.ts
// - Message pooling
// - Compression for large payloads
// - Automatic batching
```

---

## 🧠 6. MEMORY MANAGEMENT

### Current Memory Profile (Estimated)

```
Main Process:     ~120MB
  ├─ Node.js:      ~50MB
  ├─ Electron:     ~40MB
  └─ App Code:     ~30MB

Renderer Process: ~180MB
  ├─ Chromium:     ~80MB
  ├─ React:        ~40MB
  ├─ Monaco:       ~60MB (if loaded)
  └─ App State:    ~20MB

Total:           ~300MB (acceptable for Electron)
```

### 🎯 Memory Optimization

#### 1. Monaco Editor Lazy Loading
```typescript
// ✅ Only load Monaco when editor view opens
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// Configure to dispose when unmounted
<MonacoEditor
  onMount={(editor, monaco) => {
    editorRef.current = editor;
  }}
  beforeMount={(monaco) => {
    // Dispose previous instances
    monaco.editor.getModels().forEach(model => model.dispose());
  }}
/>
```

#### 2. Message History Limits
```typescript
// ✅ Limit in-memory message history
const MAX_MESSAGES = 100;

const loadMessages = async () => {
  const response = await window.cortex.db.query({
    query: `
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `,
    params: [sessionId, MAX_MESSAGES],
  });
  
  // Reverse to show chronologically
  setMessages(response.data.rows.reverse());
};
```

#### 3. Memory Leak Prevention
```typescript
// ✅ Clean up subscriptions
useEffect(() => {
  const cleanup = window.cortex.on('event:automation-completed', handler);
  return () => cleanup(); // Unsubscribe
}, []);
```

#### 4. Garbage Collection Hints
```typescript
// ✅ Already enabled in main/index.ts
app.commandLine.appendSwitch('js-flags', '--expose-gc');

// Manually trigger GC after large operations (if needed)
if (global.gc) {
  global.gc();
}
```

---

## 🔧 7. PERFORMANCE MONITORING

### ✅ Infrastructure Already in Place

```typescript
// packages/main/src/performance/
├── profiler.ts          // ✅ Metric collection
├── memory-manager.ts    // ✅ Memory monitoring
├── ipc-optimizer.ts     // ✅ IPC optimization
├── database-optimizer.ts// ✅ DB optimization
└── v8-cache.ts         // ✅ V8 caching
```

### Real-time Monitoring

```typescript
// ✅ Profiler usage
profiler.start('operation-name', 'category');
// ... operation
profiler.end('operation-name');

// ✅ Get reports
const report = profiler.getReport();
/*
{
  uptime: 120000,
  metrics: [...],
  memorySnapshots: [...],
  summary: {
    avgIpcLatency: 5.2,
    avgDatabaseQuery: 8.1,
    avgRenderTime: 16.3,
    peakMemory: 180000000
  }
}
*/
```

### 🎯 Additional Monitoring Recommendations

#### 1. Add User Timing API in Renderer
```typescript
// ✅ Measure render performance
const measureRender = (componentName: string) => {
  performance.mark(`${componentName}-start`);
  
  return () => {
    performance.mark(`${componentName}-end`);
    performance.measure(
      componentName,
      `${componentName}-start`,
      `${componentName}-end`
    );
    
    const measure = performance.getEntriesByName(componentName)[0];
    console.log(`${componentName} render: ${measure.duration}ms`);
  };
};

// Usage
const ChatView = () => {
  useEffect(() => {
    const endMeasure = measureRender('ChatView');
    return endMeasure;
  }, []);
};
```

#### 2. Real User Monitoring (RUM)
```typescript
// ✅ Track real user performance
const trackPerformance = () => {
  const timing = performance.timing;
  const metrics = {
    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
    fullyLoaded: timing.loadEventEnd - timing.navigationStart,
    firstPaint: performance.getEntriesByType('paint')[0]?.startTime
  };
  
  // Send to analytics or log
  logger.info('performance:metrics', metrics);
};
```

---

## 📈 8. FLAMEGRAPH ANALYSIS

### How to Generate Flamegraphs

#### Chrome DevTools Profiling
```bash
# 1. Launch app in dev mode
bun run dev

# 2. Open DevTools (Cmd+Opt+I)

# 3. Go to Performance tab → Record → Stop

# 4. Export profile:
#    - Click gear icon → "Save profile..."
#    - Save as profile.json

# 5. Visualize with speedscope:
npm install -g speedscope
speedscope profile.json
```

#### Node.js CPU Profiling (Main Process)
```bash
# Start with --inspect
electron --inspect=9229 .

# In Chrome: chrome://inspect
# Click "inspect" → Go to Profiler tab → Start

# Generate flamegraph
node --prof app.js
node --prof-process isolate-*.log > profile.txt
```

### Sample Flamegraph Analysis

```
Top Time Consumers (Estimated):
┌─────────────────────────────────────────────────────┐
│ Function Call                    Time    % Total    │
├─────────────────────────────────────────────────────┤
│ Prism.highlight                  42ms    35%  ⚠️    │
│ React.render                     28ms    23%        │
│ DOM.updateTree                   18ms    15%        │
│ JSON.parse/stringify             12ms    10%        │
│ SQLite.query                     10ms     8%        │
│ Other                            10ms     9%        │
└─────────────────────────────────────────────────────┘

🎯 Optimization: Move Prism.highlight to Web Worker
   Expected Impact: 35% faster rendering
```

---

## 🎯 9. PRIORITIZED RECOMMENDATIONS

### 🔴 High Priority (Immediate Impact)

#### 1. Lazy Load Syntax Highlighting (Impact: 🔥🔥🔥)
- **File**: `packages/renderer/src/views/agents/ChatView.tsx`
- **Change**: Move Prism imports to dynamic imports
- **Benefit**: 120KB bundle reduction, 300ms faster initial load
- **Effort**: 2 hours

#### 2. Implement Code Splitting (Impact: 🔥🔥🔥)
- **File**: `packages/renderer/vite.config.ts`
- **Change**: Split large chunks into lazy-loaded routes
- **Benefit**: 57% smaller initial bundle (648KB → 280KB)
- **Effort**: 4 hours

#### 3. Remove Production Source Maps (Impact: 🔥🔥🔥)
- **File**: `vite.config.ts` (all packages)
- **Change**: `sourcemap: false` in production
- **Benefit**: 4.5MB smaller build, faster installation
- **Effort**: 15 minutes

#### 4. Memoize ChatView Messages (Impact: 🔥🔥)
- **File**: `ChatView.tsx`
- **Change**: Wrap MessageItem in React.memo
- **Benefit**: 97% faster updates (150ms → 5ms)
- **Effort**: 1 hour

### 🟡 Medium Priority (Significant Improvement)

#### 5. Defer Non-Critical Startup (Impact: 🔥🔥)
- **File**: `packages/main/src/index.ts`
- **Change**: Move performance monitoring after window creation
- **Benefit**: 300-400ms faster startup
- **Effort**: 2 hours

#### 6. Implement Virtual Scrolling (Impact: 🔥)
- **File**: `ChatView.tsx`
- **Change**: Use `@tanstack/react-virtual`
- **Benefit**: Smooth performance with 1000+ messages
- **Effort**: 3 hours

#### 7. Tree-shake Lucide Icons (Impact: 🔥)
- **File**: Multiple components
- **Change**: Import only needed icons
- **Benefit**: ~40KB reduction
- **Effort**: 1 hour

### 🟢 Low Priority (Polish)

#### 8. Web Worker for Syntax Highlighting
- **Benefit**: Non-blocking highlighting
- **Effort**: 4 hours

#### 9. Optimize Icon Imports
- **Benefit**: Small bundle reduction
- **Effort**: 30 minutes

#### 10. Add Performance Budgets
- **Benefit**: Prevent regressions
- **Effort**: 1 hour

---

## 📋 10. IMPLEMENTATION CHECKLIST

### Week 1: Quick Wins
- [x] Remove production source maps — **4.49 MB removed** (5.84 MB → 1.35 MB build)
- [x] Lazy load Prism.js — **106.7 KB** (31.7 KB gzip) moved to 10 on-demand chunks
- [x] Memoize ChatView messages — **95.2% of parse work eliminated**, 5.6x faster
- [ ] Tree-shake icon imports
- [x] Measure baseline performance — see "Measured Results" below

> ⚠️ Note: several size estimates in the sections above were not measured and
> proved inaccurate. See "Measured Results" for verified numbers and corrections.

### Week 2: Code Splitting
- [ ] Implement route-based splitting
- [ ] Lazy load Monaco Editor
- [ ] Split vendor chunks optimally
- [ ] Add loading states
- [ ] Test bundle sizes

### Week 3: Runtime Optimizations
- [ ] Defer startup services
- [ ] Implement virtual scrolling
- [ ] Add Web Worker for highlighting
- [ ] Optimize auto-scroll
- [ ] Profile memory usage

### Week 4: Monitoring & Testing
- [ ] Add performance budgets
- [ ] Set up CI performance checks
- [ ] Create regression tests
- [ ] Generate flamegraphs
- [ ] Document best practices

---

## 🧪 11. PERFORMANCE TESTING SCRIPTS

### Scripts Created
```bash
# Analyze bundle sizes
bun scripts/profile-bundle.ts

# Profile database queries
bun scripts/profile-database.ts

# Measure IPC latency
bun scripts/profile-ipc.ts

# Guide for runtime profiling
bun scripts/profile-runtime.ts

# Measure startup time (requires full run)
bun scripts/profile-startup.ts
```

### Performance Reports Location
```
performance-reports/
├── bundle-analysis-*.json
├── database-profile-*.json
├── ipc-profile-*.json
├── runtime-profile-*.json
└── startup-profile-*.json
```

---

## 📊 12. EXPECTED RESULTS AFTER OPTIMIZATION

### Before vs After

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Startup Time** | ~3.8s | ~2.2s | **42% faster** |
| **Initial Bundle** | 648KB | 280KB | **57% smaller** |
| **First Paint** | 1600ms | 800ms | **50% faster** |
| **Message Render** | 150ms | 5ms | **97% faster** |
| **Build Size** | 5.63MB | 1.15MB | **80% smaller** |
| **IPC Latency** | 5-10ms | 3-7ms | **30% faster** |
| **Memory Usage** | 300MB | 250MB | **17% less** |

### User-Perceived Performance

- ⚡ App opens in < 2.5 seconds (vs 4 seconds)
- ⚡ Chat messages appear instantly
- ⚡ Smooth scrolling even with 1000+ messages
- ⚡ No UI freezes during syntax highlighting
- ⚡ Faster installation (smaller download)

---

## 🔬 13. CONTINUOUS MONITORING

### Performance Budgets (Recommended)

```javascript
// Add to vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Fail build if chunks exceed limits
        experimentalMinChunkSize: 10000,
        manualChunks(id) {
          // Ensure vendor chunks stay under 200KB
          if (id.includes('node_modules')) {
            // Automatic optimal chunking
          }
        }
      }
    },
    // Warn if any chunk > 500KB
    chunkSizeWarningLimit: 500
  }
});
```

### CI/CD Performance Checks

```yaml
# .github/workflows/performance.yml
name: Performance Check
on: [pull_request]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: bun install
      - name: Build
        run: bun run build
      - name: Analyze bundle
        run: bun scripts/profile-bundle.ts
      - name: Check bundle size
        run: |
          SIZE=$(du -sb packages/renderer/dist | cut -f1)
          if [ $SIZE -gt 1500000 ]; then
            echo "Bundle too large: $SIZE bytes"
            exit 1
          fi
```

---

## 🎓 14. PERFORMANCE BEST PRACTICES

### Development Guidelines

#### ✅ DO
- Use React.memo for expensive components
- Lazy load heavy dependencies
- Profile before optimizing
- Measure actual impact
- Use virtualization for long lists
- Cache expensive computations
- Defer non-critical initialization

#### ❌ DON'T
- Optimize prematurely
- Add dependencies without checking size
- Block the main thread
- Create memory leaks with uncleaned listeners
- Use inline functions as props
- Re-render entire lists
- Load everything upfront

---

## 📝 CONCLUSION

Cortex IDE has a **solid performance foundation** with comprehensive monitoring already in place. The main opportunities for improvement are:

1. **Bundle Optimization** (57% reduction possible)
2. **Startup Optimization** (42% faster possible)
3. **Runtime React Optimizations** (97% faster renders)

Implementing the high-priority recommendations will result in a **significantly faster, more responsive application** with minimal effort (8-10 hours of work).

The infrastructure for continuous performance monitoring is excellent - just need to add alerting and CI/CD checks to prevent regressions.

---

**Next Steps**: Start with the High Priority items in order, measuring impact after each change.

**Questions?** Check `performance-reports/` for detailed analysis data.

---

## ✅ MEASURED RESULTS (Week 1 quick wins)

All figures below are measured, with the commands to reproduce them. Where the
original estimates in this document turned out to be wrong, the correction is
stated explicitly.

### 1. Production source maps removed

| | Before | After |
|---|---|---|
| Total build output | 5.84 MB | **1.35 MB** |
| Source map bytes | 4.64 MB | **0 B** |

**Saved: 4.49 MB (77% of the build).** Matches the ~4.5 MB estimate.

Changed `packages/{renderer,main,preload}/vite.config.ts` to key off Vite's
`mode` instead of `process.env.NODE_ENV`. The old renderer check was
`process.env.NODE_ENV === 'production' ? 'hidden' : true`, but `bun run build`
never sets `NODE_ENV`, so it silently took the `true` branch and always emitted
maps. `main` and `preload` had `sourcemap: true` unconditionally.

Reproduce: `bun run build && bun scripts/profile-bundle.ts`

### 2. Prism.js lazy loaded

| | Before | After |
|---|---|---|
| Initial (eager) payload | 287.4 KB | **180.7 KB** |
| gzipped | 72.3 KB | **40.5 KB** |
| Deferred chunks | 0 | **10** |

**Saved: 106.7 KB (31.7 KB gzip) — 37% of the initial payload.** Close to the
120 KB estimate.

Verified in the real production build: the entry chunk contains **zero** Prism
bytes, and Prism ships as 10 separate chunks (`prism`, `prism-typescript`,
`prism-python`, `prism-rust`, `prism-json`, `prism-bash`, `prism-jsx`,
`prism-tsx`, the theme CSS, and `purify.es`) fetched only when a fenced code
block renders. Because each grammar is its own chunk, a Python block pulls
~22 KB rather than the whole set.

Implementation notes:
- `src/lib/syntax-highlight.ts` uses an **explicit loader map**, not
  `import(\`prismjs/components/prism-${lang}\`)`. A template-literal dynamic
  import makes the bundler emit a chunk for every one of Prism's ~290 language
  files, which would defeat the optimization.
- DOMPurify (~29 KB) is also deferred, since sanitizing is only needed when
  there is highlighted HTML to sanitize.
- `src/components/chat/CodeBlock.tsx` renders plain text on first paint and
  upgrades to highlighted markup when the grammar resolves, so there is no
  blank frame and no layout shift. Unsupported languages stay as plain text.
- Highlighted HTML is still DOMPurify-sanitized (`span` tags, `class`/`style`
  attributes only) before reaching `dangerouslySetInnerHTML`.

Reproduce: `bun packages/renderer/scripts/measure-prism-split.ts`

### 3. Message list memoized

| Scenario | Unmemoized | Memoized | Improvement |
|---|---|---|---|
| 20 messages, 30 stream chunks | 630 parses / 14.2 ms | **30 parses / 2.5 ms** | 95.2% less work, 5.6x faster |
| 200 messages, 20 stream chunks | 4020 parses / 60.2 ms | **20 parses / 6.9 ms** | 99.5% less work, 8.8x faster |

The per-message work is now **independent of list length** — it scales with the
number of stream chunks alone, so the benefit grows with conversation size.

Correction to the original estimate: the "150ms → 5ms (97% faster)" figure was
not reproducible as stated. The measured reduction in *per-message work* is
95.2% at 20 messages and 99.5% at 200 messages; measured wall-clock speedup is
5.6x–8.8x in jsdom. Absolute milliseconds depend on message count and
environment, so the ratio is the meaningful number.

Implementation: `React.memo` on `MessageBubble` with a field-level comparator,
`useMemo` for content parsing and for the mapped list, `useCallback` for
handlers. Content parsing was extracted into the pure, exported
`parseMessageContent` so it is directly testable.

Reproduce: `bunx vitest run src/__tests__/message-memoization.bench.test.tsx`
(from `packages/renderer`)

### Corrections to earlier estimates in this document

The bundle composition in §1 was not measured and is substantially wrong. Byte
attribution via sourcemap decoding (`bun scripts/attribute-bundle.ts <map>`)
showed the actual 693 KB chunk was:

| Package | Share |
|---|---|
| recharts | 243.4 KB (35.2%) |
| react-diff-view | 56.6 KB (8.2%) |
| zod | 54.3 KB (7.8%) |
| app code (`src/views`, `src/components`) | ~70 KB (10.2%) |
| d3-* (recharts deps) | ~48 KB (7%) |

- **Prism.js, DOMPurify and Monaco were not in the bundle at all.** `ChatView`
  was unreachable from the app entry, so it was tree-shaken; the "120 KB Prism"
  and "60 KB Monaco loader" line items did not exist in the shipped output.
- **Lucide icons were ~37 KB in `vendor-ui`, not 80 KB in the main chunk.**
- The real optimization target for further bundle work is **recharts**, which is
  over a third of the chunk and is used only by chart/debug panels.

### Incidental fixes required to get here

- `packages/main/vite.config.ts`: `node:url` was missing from `external`, so
  `bun run build` **failed** and `perf:all` could not complete. Replaced the
  hand-maintained list of `node:`-prefixed entries with `/^node:/` (plus
  `/^bun:/` for `bun:sqlite`, which also removes an empty-chunk warning).
- `packages/renderer/src/components/git/GitStashPanel.tsx:273`: invalid JSX
  (`stash@{{{stash.index}}}` parses as a nested object literal). This syntax
  error caused `tsc` to abort before semantic analysis, hiding **225** type
  errors project-wide — the typecheck appeared to report only 3.
- Added `packages/renderer/src/types/prismjs-components.d.ts`; `@types/prismjs`
  declares only the main entry, not the grammar side-effect modules.

Net typecheck effect: **175 → 164 errors** (measured with an identical
toolchain state, reverting only this work). The 9 pre-existing `ChatView`
errors are fixed, including calls that did not match the preload API
(`streamResponse` needs an `onChunk` callback; `stopStream` takes a string).

Two latent runtime bugs in `ChatView` were fixed as part of the rework:
- An IPC listener was registered inside `handleSend` via
  `window.electron.ipcRenderer.on` — an API the preload does not expose — and
  was never removed, so handlers accumulated with every message sent.
- The in-flight `AbortController` was never aborted on unmount.

### Highest-value follow-up found while measuring

`NotesView` is now the largest chunk at **790 KB**, and byte attribution shows
**73.4% of it is `refractor`** (577.7 KB) — every one of Prism's ~290 language
grammars, pulled in transitively by `react-syntax-highlighter`. Individual
grammars nobody asked for are shipping: `lang/sqf.js` alone is 32.6 KB and
`lang/vim.js` is 13.9 KB.

`DocumentationViewer.tsx` and `NotesView.tsx` both do:

```typescript
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
```

This is the same problem the Prism work above solved, in a bigger chunk. Two
options, in order of preference:

1. Reuse `lib/syntax-highlight.ts` + `CodeBlock` in both views and drop the
   `react-syntax-highlighter` dependency (~580 KB off the lazy chunk, and it
   deletes a dependency rather than configuring one).
2. If the component API is worth keeping, switch to the light build
   (`react-syntax-highlighter/dist/esm/prism-light`) and register only the
   needed languages.

Reproduce: `bun scripts/attribute-bundle.ts <path-to-.js.map> [topN]`
(build with `--mode development` first, since production no longer emits maps)

### Remaining known issues (not introduced here)

- 164 pre-existing typecheck errors, 36 of them in `packages/preload/src/index.ts`
  (imports request/response types that `@cortex-ide/shared` does not export).
- The repo runs two test runners with overlapping globs: suites importing
  `bun:test` fail under `vitest` and vice versa. Worth standardising on one.
- `TerminalGrid` suite failures are unrelated to this work.
