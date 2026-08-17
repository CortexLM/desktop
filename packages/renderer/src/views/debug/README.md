# Debug Views - Cortex IDE

This directory contains all React components for the Debug Panel interface.

## Components

### DebugPanel.tsx
Main container component that orchestrates all debug views.

**Features:**
- Tabbed interface with 5 tabs
- Export logs button
- Close panel button
- Integrates all sub-panels

**Usage:**
```tsx
import { DebugPanel } from './views/debug/DebugPanel';

<DebugPanel onClose={() => setShowDebugPanel(false)} />
```

---

### ConsolePanel.tsx
Real-time log viewer with advanced filtering.

**Features:**
- Search logs by content
- Filter by level (debug/info/warn/error)
- Filter by source (main/renderer)
- Filter by category
- Auto-scroll toggle
- Clear logs button
- Expandable stack traces

**Data Source:** `window.electron.invoke('debug:get-logs', limit)`

---

### IPCInspector.tsx
Monitor all Inter-Process Communication messages.

**Features:**
- Message list with timestamps
- Direction indicators (→ renderer→main, ← main→renderer)
- Channel filtering
- Direction filtering
- Expandable message payloads
- Request/response timing
- Channel statistics sidebar

**Data Source:** 
- `window.electron.invoke('debug:get-ipc-messages', limit)`
- `window.electron.invoke('debug:get-ipc-stats')`

---

### PerformancePanel.tsx
Live performance metrics and charts.

**Features:**
- Real-time line charts (recharts)
- Category selection (timing, memory, cpu, app)
- Multiple metrics per chart
- Statistics sidebar (min/max/avg/count)
- Auto-refresh every 2 seconds

**Data Source:** `window.electron.invoke('debug:get-metrics', category, limit)`

---

### MemoryPanel.tsx
Memory usage visualization and profiling.

**Features:**
- Live memory charts (4 metrics):
  - Heap Used (blue)
  - Heap Total (green)
  - External (yellow)
  - RSS (red)
- Current memory stats cards
- System information
- Auto-refresh every 2 seconds

**Data Source:** 
- `window.electron.invoke('debug:get-memory', limit)`
- `window.electron.invoke('debug:get-system-info')`

---

### SettingsPanel.tsx
Debug configuration and system information.

**Features:**
- Enable/disable debug mode
- Log level selector
- Max log size configuration
- Log rotation toggle
- Category toggles (ipc, performance, network, etc.)
- System information display
- Save/reset buttons

**Data Source:** 
- `window.electron.invoke('debug:get-settings')`
- `window.electron.invoke('debug:update-settings', settings)`

---

## Common Patterns

### Data Fetching
All panels use polling with `setInterval` for real-time updates:

```tsx
React.useEffect(() => {
  loadData();
  const interval = setInterval(loadData, 2000); // 2 seconds
  return () => clearInterval(interval);
}, []);
```

### IPC Communication
```tsx
const result = await window.electron.invoke('debug:get-logs', 100);
```

### Styling
All components use Tailwind CSS with the Cortex IDE design system:
- Background: `bg-background`, `bg-surface`
- Text: `text-text`, `text-text-secondary`
- Borders: `border-border`
- Accent: `text-accent`, `bg-accent`

### Charts
Performance and Memory panels use `recharts` for visualization:
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
```

---

## File Structure

```
packages/renderer/src/views/debug/
├── DebugPanel.tsx        # Main container
├── ConsolePanel.tsx      # Log viewer
├── IPCInspector.tsx      # IPC monitor
├── PerformancePanel.tsx  # Performance metrics
├── MemoryPanel.tsx       # Memory profiler
└── SettingsPanel.tsx     # Configuration
```

---

## Integration

These components are integrated into the main app via `App.tsx`:

```tsx
import { DebugPanel } from './views/debug/DebugPanel';
import { DebugProvider, useDebug } from './contexts/DebugContext';

function AppContent() {
  const { showDebugPanel, setShowDebugPanel } = useDebug();
  
  return (
    <>
      {/* Main content */}
      {showDebugPanel && (
        <DebugPanel onClose={() => setShowDebugPanel(false)} />
      )}
    </>
  );
}

<DebugProvider>
  <AppContent />
</DebugProvider>
```

---

## Development

### Adding a New Debug View

1. Create new component file in this directory
2. Import it in `DebugPanel.tsx`
3. Add new tab to `TabsList`
4. Add corresponding `TabsContent`
5. Implement data fetching from IPC
6. Style with Tailwind CSS

### Example New Tab

```tsx
// NewDebugView.tsx
export function NewDebugView() {
  const [data, setData] = React.useState([]);
  
  React.useEffect(() => {
    const load = async () => {
      const result = await window.electron.invoke('debug:new-feature');
      setData(result);
    };
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="h-full p-4">
      {/* Your UI */}
    </div>
  );
}
```

---

## Performance Considerations

- **Polling intervals**: Use 2-5 seconds for most data
- **Data limits**: Request only last N entries (100-1000)
- **Auto-scroll**: Make it toggleable for better UX
- **Chart data**: Limit to 50-100 points for smooth rendering
- **Large payloads**: Truncate or paginate display

---

## Accessibility

- Use semantic HTML elements
- Provide keyboard navigation
- Include ARIA labels where needed
- Ensure sufficient color contrast
- Support keyboard shortcuts

---

## See Also

- [DebugContext.tsx](../../contexts/DebugContext.tsx) - State management
- [ErrorBoundary.tsx](../../components/ErrorBoundary.tsx) - Error handling
- [DEBUG.md](../../../../../DEBUG.md) - Full documentation
- [DEBUG_QUICKSTART.md](../../../../../DEBUG_QUICKSTART.md) - Quick start guide
