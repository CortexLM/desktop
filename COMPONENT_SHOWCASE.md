# Component Showcase

## 🎨 Visual Guide to New Components

### 1. Toast Notifications

```
┌─────────────────────────────────────────┐
│ ✓ Settings saved successfully           │  ← Success (green)
│   Your changes have been applied         │
│                                      [×] │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ⚠ Unsaved changes                       │  ← Warning (yellow)
│   You have unsaved changes               │
│                                      [×] │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ⓘ Update available                      │  ← Info (blue)
│   Version 2.0 is ready                   │
│   [Install Now]                      [×] │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✕ Failed to save                        │  ← Error (red)
│   Check your network connection          │
│                                      [×] │
└─────────────────────────────────────────┘
```

**Location**: Top-right corner, z-index 100

---

### 2. Skeleton Loading States

#### SkeletonList (5 items)
```
┌──────────────────────────────────────────┐
│ ⬤  ▁▁▁▁▁▁▁▁▁                           │
│     ▁▁▁▁▁▁▁▁▁▁▁▁▁▁                     │
├──────────────────────────────────────────┤
│ ⬤  ▁▁▁▁▁▁▁▁▁                           │
│     ▁▁▁▁▁▁▁▁▁▁▁▁▁▁                     │
├──────────────────────────────────────────┤
│ ⬤  ▁▁▁▁▁▁▁▁▁                           │
│     ▁▁▁▁▁▁▁▁▁▁▁▁▁▁                     │
└──────────────────────────────────────────┘
```

#### SkeletonCard
```
┌──────────────────────────────────────────┐
│ ▁▁▁▁▁▁▁▁▁▁                              │
│                                          │
│ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁        │
│ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁                   │
│                                          │
│ [▁▁▁▁▁▁] [▁▁▁▁▁▁]                      │
└──────────────────────────────────────────┘
```

#### SkeletonTable (3×4)
```
┌────────┬────────┬────────┬────────┐
│ ▁▁▁▁▁ │ ▁▁▁▁▁ │ ▁▁▁▁▁ │ ▁▁▁▁▁ │ ← Header
├────────┼────────┼────────┼────────┤
│ ▁▁▁▁▁ │ ▁▁▁▁▁ │ ▁▁▁▁▁ │ ▁▁▁▁▁ │
│ ▁▁▁▁▁ │ ▁▁▁▁▁ │ ▁▁▁▁▁ │ ▁▁▁▁▁ │
│ ▁▁▁▁▁ │ ▁▁▁▁▁ │ ▁▁▁▁▁ │ ▁▁▁▁▁ │
└────────┴────────┴────────┴────────┘
```

---

### 3. Welcome Screen

```
╔══════════════════════════════════════════════════╗
║           Welcome to Cortex IDE              [×] ║
║  The AI agent orchestrator for complex missions  ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  ┌───────┐  ┌───────┐  ┌───────┐               ║
║  │  🎯   │  │  📊   │  │  🧠   │               ║
║  │Mission│  │Bench- │  │ Smart │               ║
║  │Orches-│  │marking│  │Context│               ║
║  │tration│  │       │  │       │               ║
║  └───────┘  └───────┘  └───────┘               ║
║                                                  ║
║  ────────────────────────────────────────────   ║
║                                                  ║
║  ▶  Take the interactive tutorial               ║
║     Learn the basics in 5 minutes               ║
║                                                  ║
║  📖 Read the documentation                      ║
║     Deep dive into features                     ║
║                                                  ║
║  ⚙  Configure AI providers                      ║
║     Set up OpenAI, Claude, Grok                 ║
║                                                  ║
║  ────────────────────────────────────────────   ║
║  ☐ Don't show this again      [Skip for now]   ║
╚══════════════════════════════════════════════════╝
```

---

### 4. Interactive Tutorial

```
╔══════════════════════════════════════════════════╗
║  Chat with AI Agents                         [×] ║
║  Your primary interface for interacting with AI  ║
╠══════════════════════════════════════════════════╣
║ ████████████████░░░░░░░░░░░░░░░  Step 2 of 5    ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  The Chat view is where you interact with AI.   ║
║  You can:                                        ║
║                                                  ║
║  • Ask questions about your codebase            ║
║  • Request code changes and refactoring         ║
║  • Get help debugging issues                    ║
║  • Run benchmarks to compare AI providers       ║
║                                                  ║
║  ┌─────────────────────────────────────────┐   ║
║  │ Try asking:                              │   ║
║  │ "Explain the architecture of this project" │
║  └─────────────────────────────────────────┘   ║
║                                                  ║
╠══════════════════════════════════════════════════╣
║  Step 2 of 5           [← Back]  [Next →]       ║
╚══════════════════════════════════════════════════╝
```

---

### 5. Settings View

```
╔══════════════════════════════════════════════════╗
║  Settings                  [Reset]  [Save]       ║
╠══════════════════════════════════════════════════╣
║  [General] [AI Providers] [Editor] [Shortcuts]  ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  APPEARANCE                                      ║
║  │                                               ║
║  │ Theme                        [Dark    ▼]     ║
║  │ Choose your color scheme                     ║
║                                                  ║
║  AUTO SAVE                                       ║
║  │                                               ║
║  │ Enable Auto Save            [✓]              ║
║  │ Automatically save files                     ║
║  │                                               ║
║  │ Auto Save Delay (ms)        [1000      ]     ║
║  │ Delay before auto-saving                     ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

#### AI Providers Tab

```
╔══════════════════════════════════════════════════╗
║  Settings                  [Reset]  [Save]       ║
╠══════════════════════════════════════════════════╣
║  [General] [AI Providers] [Editor] [Shortcuts]  ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  OPENAI                                          ║
║  │                                               ║
║  │ Enabled                      [✓]              ║
║  │ Enable OpenAI integration                    ║
║  │                                               ║
║  │ API Key                      [sk-•••••• 👁]  ║
║  │ Your API key (stored securely)               ║
║  │                                               ║
║  │ Available Models                             ║
║  │ • gpt-4o                                     ║
║  │ • gpt-4-turbo                                ║
║  │ • gpt-3.5-turbo                              ║
║                                                  ║
║  ANTHROPIC (CLAUDE)                              ║
║  │                                               ║
║  │ Enabled                      [✓]              ║
║  │ ...                                          ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

---

## 🎯 Component Hierarchy

```
App
├── ErrorBoundary
│   └── ToastProvider
│       └── DebugProvider
│           └── AppContent
│               ├── Header
│               │   ├── Settings Button
│               │   └── Debug Toggle
│               ├── Main Content
│               │   ├── SettingsView (conditional)
│               │   │   ├── General Tab
│               │   │   ├── AI Providers Tab
│               │   │   ├── Editor Tab
│               │   │   └── Shortcuts Tab
│               │   └── GitPanel (conditional)
│               ├── UpdateNotification
│               ├── WelcomeScreen (first launch)
│               └── InteractiveTutorial (on demand)
└── ToastContainer (auto-rendered)
```

---

## 🔄 State Flow

```
┌─────────────────────┐
│   localStorage      │
│                     │
│ cortex:onboarding   │◄────┐
│ cortex:settings     │     │
│ cortex:skip-welcome │     │
└─────────────────────┘     │
          ▲                 │
          │                 │
          │ persist         │ load
          │                 │
          │                 ▼
┌─────────────────────┐   ┌──────────────┐
│   useOnboarding     │   │ SettingsView │
│                     │   │              │
│ - hasSeenWelcome    │   │ - theme      │
│ - hasCompletedTut   │   │ - providers  │
│ - hasConfigured     │   │ - editor     │
└─────────────────────┘   └──────────────┘
          │
          │ controls
          ▼
┌─────────────────────┐
│   WelcomeScreen     │
│   Tutorial          │
└─────────────────────┘
```

---

## 📊 Data Flow: Toast System

```
Component A                useToast Hook           ToastContext
    │                          │                       │
    │  toast.success()         │                       │
    ├─────────────────────────►│                       │
    │                          │  addToast()           │
    │                          ├──────────────────────►│
    │                          │                       │
    │                          │                   [Add to state]
    │                          │                       │
    │                          │                       ├─►ToastContainer
    │                          │                       │      │
    │                          │                       │  [Render toast]
    │                          │                       │      │
    │                          │   Auto-dismiss        │      │
    │                          │◄──────────────────────┤      │
    │                          │                       │      │
    │                          │  removeToast()        │      │
    │                          ├──────────────────────►│      │
    │                          │                       │      │
    │                          │                [Remove from state]
    │                          │                       │      │
    │                          │                       ├─►[Fade out]
```

---

## 🚀 Usage Patterns

### Pattern 1: Loading → Success → Error
```tsx
function MyComponent() {
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  
  useEffect(() => {
    loadData()
      .then(() => {
        toast.success('Data loaded');
        setLoading(false);
      })
      .catch((err) => {
        toast.error('Failed to load', err.message);
        setLoading(false);
      });
  }, []);
  
  if (loading) return <SkeletonList count={5} />;
  return <DataList />;
}
```

### Pattern 2: Form Submission
```tsx
function SettingsForm() {
  const toast = useToast();
  
  const handleSubmit = async (data) => {
    try {
      await saveSettings(data);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings', error.message);
    }
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Pattern 3: Onboarding Check
```tsx
function App() {
  const { shouldShowWelcome, markWelcomeSeen } = useOnboarding();
  
  return (
    <>
      {/* Main app */}
      <MainContent />
      
      {/* Show welcome on first launch */}
      {shouldShowWelcome && (
        <WelcomeScreen onClose={markWelcomeSeen} />
      )}
    </>
  );
}
```

---

## 🎨 Theming

All components respect CSS variables:

```css
:root {
  --background: #0a0a0a;      /* Dark background */
  --surface: #141414;          /* Card/panel bg */
  --border: #2a2a2a;          /* Border color */
  --text: #e0e0e0;            /* Primary text */
  --text-secondary: #a0a0a0;  /* Secondary text */
  --accent: #3b82f6;          /* Accent color */
}

/* Components automatically adapt */
.toast { background: var(--background); }
.skeleton { background: var(--surface); }
```

---

## 📦 Bundle Analysis

```
Total Bundle: 709.87 kB
├─ Monaco Editor: ~600 KB (84.5%)
├─ React + UI libs: ~85 KB (12%)
└─ New features: ~25 KB (3.5%)
    ├─ Toast: ~3 KB
    ├─ Skeleton: ~2 KB
    ├─ Onboarding: ~8 KB
    └─ Settings: ~12 KB
```

**Impact**: Minimal bundle size increase for significant UX improvement.

---

## ✅ Checklist for Developers

### Before Using New Features
- [ ] Wrap app with `<ToastProvider>`
- [ ] Ensure ErrorBoundary is at root
- [ ] Define CSS variables for theming
- [ ] Configure localStorage persistence

### When Adding Toast
- [ ] Use appropriate type (success/error/warning/info)
- [ ] Provide clear message
- [ ] Add description for context
- [ ] Consider action buttons for important toasts

### When Adding Skeletons
- [ ] Match skeleton to actual content shape
- [ ] Show immediately (don't wait)
- [ ] Use pre-built patterns when possible
- [ ] Keep animation consistent

### When Modifying Onboarding
- [ ] Keep tutorial steps under 5
- [ ] Provide skip option
- [ ] Test localStorage persistence
- [ ] Ensure reset works

### When Adding Settings
- [ ] Provide sensible defaults
- [ ] Validate input
- [ ] Show save confirmation
- [ ] Persist to localStorage

---

**End of Component Showcase**
