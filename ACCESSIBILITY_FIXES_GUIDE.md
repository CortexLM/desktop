# Accessibility Implementation Guide

## Quick Fixes Checklist

Use this checklist to systematically fix all accessibility issues found in the audit.

## 🔴 Critical Fixes (Start Here)

### 1. Icon-Only Buttons (1 hour)

**Files to update:**
- `packages/renderer/src/views/agents/ChatView.tsx`
- `packages/renderer/src/views/workspace/TerminalTab.tsx`
- `packages/renderer/src/views/editor/FileExplorer.tsx`

**Pattern:**
```tsx
// Find all instances of:
<Button size="icon">
  <IconComponent />
</Button>

// Replace with:
<Button size="icon" aria-label="Descriptive action">
  <IconComponent aria-hidden="true" />
</Button>
```

**Specific instances to fix:**

#### ChatView.tsx (line ~269)
```tsx
<Button
  onClick={handleSend}
  disabled={!input.trim() || isStreaming}
  size="icon"
  aria-label="Send message"
  className="h-[44px] w-[44px] rounded-full"
>
  <Send className="w-4 h-4" aria-hidden="true" />
</Button>
```

#### TerminalTab.tsx (lines ~180-190)
```tsx
<button
  onClick={handleSearch}
  aria-label="Search terminal output"
  className="..."
>
  <Search className="h-4 w-4" aria-hidden="true" />
</button>

<button
  onClick={handleCopy}
  aria-label="Copy terminal content"
  className="..."
>
  <Copy className="h-4 w-4" aria-hidden="true" />
</button>

<button
  onClick={onClose}
  aria-label="Close terminal"
  className="..."
>
  <X className="h-4 w-4" aria-hidden="true" />
</button>
```

---

### 2. Form Input Labels (30 minutes)

**Files to update:**
- `packages/renderer/src/App.tsx`
- `packages/renderer/src/views/workspace/TerminalTab.tsx`

#### App.tsx (line ~42-47)
```tsx
// Replace:
<div className="flex items-center gap-2">
  <label className="text-xs text-text-secondary">Repo Path:</label>
  <input
    type="text"
    value={repoPath}
    onChange={(e) => setRepoPath(e.target.value)}
    className="flex-1 max-w-md px-2 py-1 text-xs bg-surface border border-border rounded-sm"
  />
</div>

// With:
<div className="flex items-center gap-2">
  <label htmlFor="repo-path" className="text-xs text-text-secondary">
    Repo Path:
  </label>
  <input
    id="repo-path"
    type="text"
    value={repoPath}
    onChange={(e) => setRepoPath(e.target.value)}
    aria-label="Repository path"
    className="flex-1 max-w-md px-2 py-1 text-xs bg-surface border border-border rounded-sm"
  />
</div>
```

#### TerminalTab.tsx (line ~201)
```tsx
// Add to search input:
<input
  id={`terminal-search-${terminalId}`}
  type="text"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  placeholder="Search..."
  aria-label="Search terminal output"
  className="..."
/>
```

---

### 3. Live Regions for Dynamic Content (2 hours)

#### ChatView.tsx - Streaming Messages

**Add after the input area:**
```tsx
{/* Add this after line 253 */}
{isStreaming && (
  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
    className="sr-only"
  >
    AI is generating a response
  </div>
)}
```

#### FileExplorer.tsx - Loading State

**Update the loading div (around line 215):**
```tsx
{isLoading && (
  <div 
    role="status"
    aria-live="polite"
    className="flex items-center justify-center p-4"
  >
    <Spinner aria-hidden="true" />
    <span>Loading files...</span>
  </div>
)}
```

---

### 4. Terminal Accessibility (4 hours)

#### TerminalTab.tsx

**Add ARIA attributes to terminal container:**
```tsx
// Update containerRef div (line ~35):
<div
  ref={containerRef}
  role="log"
  aria-label={`Terminal ${terminalId}`}
  aria-live="polite"
  aria-atomic="false"
  className={className}
/>

// Add accessibility notice after terminal:
<div className="sr-only" role="status">
  Terminal output is updating. This is a graphical terminal emulator.
  For accessible terminal history, use the output log view.
</div>
```

---

## 🟡 Important Fixes

### 5. Skip Navigation Link (30 minutes)

#### App.tsx

**Add at the very beginning of the component:**
```tsx
import { SkipNavLink } from './components/accessibility/accessibility-fixes';

function AppContent() {
  // ... existing state ...

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-text">
      {/* Add skip link first */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-sm"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="h-12 border-b border-border flex items-center px-4 gap-4">
        {/* ... existing header content ... */}
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden">
        {/* ... existing content ... */}
      </main>
    </div>
  );
}
```

---

### 6. Semantic HTML Landmarks (2 hours)

#### App.tsx

```tsx
// Update the structure:
<div className="h-screen w-screen flex flex-col bg-background text-text">
  {/* Skip link */}
  <a href="#main-content" className="sr-only focus:not-sr-only...">
    Skip to main content
  </a>

  {/* Header with role="banner" */}
  <header 
    className="h-12 border-b border-border flex items-center px-4 gap-4"
    role="banner"
  >
    <h1 className="text-sm font-semibold">Cortex IDE - Git Integration Demo</h1>
    {/* ... rest of header ... */}
  </header>

  {/* Main content with role="main" */}
  <main 
    id="main-content"
    className="flex-1 flex flex-col overflow-hidden"
    role="main"
  >
    <div className={`${showDebugPanel ? 'h-1/2' : 'flex-1'} overflow-hidden`}>
      <GitPanel repoPath={repoPath} />
    </div>

    {showDebugPanel && (
      <aside 
        className="h-1/2 border-t border-border"
        role="complementary"
        aria-label="Debug panel"
      >
        <DebugPanel onClose={() => setShowDebugPanel(false)} />
      </aside>
    )}
  </main>
</div>
```

---

### 7. Code Block Accessibility (1 hour)

#### ChatView.tsx

**Update the MessageBubble component (around line 318):**

```tsx
// Replace the code block rendering section:
parts.push(
  <div key={`code-${match.index}`} className="my-3">
    <div 
      className="flex items-center justify-between px-3 py-1.5 bg-elevated border-b border-border-dark rounded-t-sm"
      role="banner"
    >
      <Badge variant="secondary" className="text-xs font-mono">
        {language}
      </Badge>
      {/* Optional: Add copy button */}
      <button
        onClick={() => navigator.clipboard.writeText(code)}
        aria-label={`Copy ${language} code to clipboard`}
        className="text-xs text-text-secondary hover:text-text"
      >
        Copy
      </button>
    </div>
    <pre 
      role="region"
      aria-label={`Code block in ${language}`}
      tabIndex={0}
      className="!mt-0 !rounded-t-none overflow-x-auto"
    >
      <code
        className={`language-${language}`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  </div>
);
```

---

### 8. File Tree ARIA (2 hours)

#### FileExplorer.tsx

**Update the Tree component:**

```tsx
<Tree
  data={data}
  aria-label="File explorer tree"
  // ... other props ...
>
  {(props: NodeRendererProps<FileNode>) => (
    <div
      role="treeitem"
      aria-expanded={props.node.isOpen}
      aria-label={`${props.node.data.type === 'directory' ? 'Folder' : 'File'}: ${props.node.data.name}`}
      // ... rest of the node renderer ...
    >
      {/* ... node content ... */}
    </div>
  )}
</Tree>
```

---

## 🟢 Enhancements

### 9. Keyboard Shortcuts Dialog (2 hours)

**Create new file:** `packages/renderer/src/components/KeyboardShortcutsDialog.tsx`

```tsx
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

interface Shortcut {
  keys: string;
  description: string;
}

const shortcuts: Shortcut[] = [
  { keys: 'Cmd/Ctrl+Shift+D', description: 'Toggle Debug Panel' },
  { keys: 'F12', description: 'Open DevTools' },
  { keys: 'Cmd/Ctrl+P', description: 'Quick Open File' },
  { keys: 'Cmd/Ctrl+S', description: 'Save File' },
  { keys: 'Esc', description: 'Close Dialog' },
  { keys: 'Tab', description: 'Navigate Forward' },
  { keys: 'Shift+Tab', description: 'Navigate Backward' },
  { keys: '?', description: 'Show This Help' },
];

export const KeyboardShortcutsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Keyboard Shortcuts</DialogTitle>
        <DialogDescription>
          Navigate Cortex IDE efficiently with these keyboard shortcuts
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 mt-4">
        {shortcuts.map((shortcut, index) => (
          <div 
            key={index}
            className="flex items-center justify-between py-2 border-b border-border-soft last:border-0"
          >
            <span className="text-sm text-text">{shortcut.description}</span>
            <kbd className="px-2 py-1 text-xs font-mono bg-elevated border border-border rounded-sm">
              {shortcut.keys}
            </kbd>
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
```

**Add to App.tsx:**
```tsx
const [showShortcuts, setShowShortcuts] = useState(false);

// Add to keyboard shortcuts handler:
React.useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setShowShortcuts(true);
    }
    // ... existing shortcuts ...
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [/* ... */]);

// Add component:
<KeyboardShortcutsDialog 
  open={showShortcuts} 
  onClose={() => setShowShortcuts(false)} 
/>
```

---

### 10. Improve Alt Text (15 minutes)

#### TeamView.tsx (line 220)
```tsx
// Before:
alt={member.name}

// After:
alt={`${member.name}'s profile picture`}
```

#### ProfileView.tsx (line 115)
```tsx
// Before:
alt="Avatar"

// After:
alt={`Profile picture of ${userName || 'user'}`}
```

---

## Testing After Fixes

### 1. Run Automated Tests
```bash
cd /root/projects/cortex-ide
bun run dev  # In one terminal
bun run test:e2e tests/accessibility/accessibility.spec.ts  # In another
```

### 2. Manual Keyboard Testing
- [ ] Tab through entire application
- [ ] All interactive elements reachable
- [ ] Focus indicators visible
- [ ] Escape closes dialogs
- [ ] Enter/Space activates buttons

### 3. Screen Reader Testing

**macOS (VoiceOver):**
```bash
# Enable VoiceOver: Cmd+F5
# Navigate with: Control+Option+Arrow keys
# Interact with: Control+Option+Space
```

**Windows (NVDA):**
```bash
# Download and start NVDA
# Navigate with: Arrow keys
# Interact with: Enter
```

### 4. Color Contrast Check

Use browser DevTools or https://webaim.org/resources/contrastchecker/

Required ratios:
- Normal text: 4.5:1
- Large text: 3:1
- UI components: 3:1

---

## Verification Checklist

After applying all fixes, verify:

- [ ] All icon buttons have aria-label
- [ ] All form inputs have labels (visible or aria-label)
- [ ] Loading states have role="status" and aria-live
- [ ] Error messages have role="alert"
- [ ] Skip navigation link works
- [ ] Semantic landmarks (<header>, <main>, <aside>) present
- [ ] Code blocks have proper ARIA
- [ ] Terminal has accessibility notice
- [ ] File tree has ARIA tree structure
- [ ] Keyboard shortcuts dialog implemented
- [ ] Alt text improved
- [ ] All tests pass
- [ ] Manual keyboard navigation works
- [ ] Screen reader announces content correctly

---

## Maintenance

Add to your development workflow:

1. **Code Review Checklist:**
   - [ ] New buttons have aria-label if icon-only
   - [ ] New inputs have labels
   - [ ] Dynamic content has live regions
   - [ ] Proper semantic HTML

2. **CI/CD Integration:**
   ```json
   // package.json
   {
     "scripts": {
       "test:a11y": "playwright test tests/accessibility/"
     }
   }
   ```

3. **ESLint Plugin:**
   ```bash
   bun add -D eslint-plugin-jsx-a11y
   ```

4. **Pre-commit Hook:**
   ```bash
   # Run accessibility tests before commit
   npm test:a11y
   ```

---

## Resources

- **Audit Report:** `ACCESSIBILITY_AUDIT.md`
- **Test Files:** `tests/accessibility/`
- **Component Fixes:** `packages/renderer/src/components/accessibility/`
- **Manual Checklist:** `tests/accessibility/manual-tests.md`

---

*Follow this guide step-by-step to achieve WCAG 2.1 AA compliance.*
