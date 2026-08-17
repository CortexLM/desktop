# Quick Start Guide - New Features

## 🚀 Using the New Features

### 1. Toast Notifications

Use the toast system anywhere in your app:

```tsx
import { useToast } from '@/components/ui/toast';

function MyComponent() {
  const toast = useToast();
  
  const handleAction = async () => {
    try {
      await doSomething();
      toast.success('Action completed!');
    } catch (error) {
      toast.error('Failed to complete action', error.message);
    }
  };
  
  return <button onClick={handleAction}>Do Something</button>;
}
```

**Toast Types**:
- `toast.success(message, description?)` - Green checkmark
- `toast.error(message, description?)` - Red alert (7s duration)
- `toast.warning(message, description?)` - Yellow warning (6s duration)
- `toast.info(message, description?)` - Blue info (5s duration)

**Advanced Usage**:
```tsx
toast.addToast({
  type: 'info',
  message: 'Update available',
  description: 'Version 2.0 is ready',
  duration: 10000, // Custom duration
  action: {
    label: 'Install Now',
    onClick: () => installUpdate()
  }
});
```

### 2. Loading Skeletons

Show loading states with skeletons:

```tsx
import { SkeletonList, SkeletonCard, Skeleton } from '@/components/ui/skeleton';

function DataList() {
  const { data, loading } = useData();
  
  if (loading) {
    return <SkeletonList count={10} />;
  }
  
  return <div>{/* render data */}</div>;
}

// Custom skeleton
function CustomLoading() {
  return (
    <div>
      <Skeleton width={200} height={24} className="mb-4" />
      <Skeleton width="100%" height={16} className="mb-2" />
      <Skeleton width="80%" height={16} />
    </div>
  );
}
```

**Pre-built Patterns**:
- `<SkeletonList count={5} />` - List items with avatars
- `<SkeletonCard />` - Card with text lines
- `<SkeletonTable rows={10} cols={4} />` - Table layout

### 3. User Onboarding

The onboarding system runs automatically:

```tsx
import { useOnboarding } from '@/hooks/use-onboarding';

function Settings() {
  const { 
    hasSeenWelcome,
    hasCompletedTutorial,
    resetOnboarding 
  } = useOnboarding();
  
  return (
    <div>
      <p>Tutorial completed: {hasCompletedTutorial ? 'Yes' : 'No'}</p>
      <button onClick={resetOnboarding}>
        Show Welcome Screen Again
      </button>
    </div>
  );
}
```

**Onboarding Flow**:
1. Welcome screen shows on first launch
2. User can start tutorial or skip
3. Tutorial has 5 steps with progress bar
4. State persists in localStorage
5. Can be reset from settings

### 4. Settings Panel

Access settings from the header:

```tsx
// Already integrated in App.tsx
// Click "⚙️ Settings" button in header
```

**Settings Tabs**:
- **General**: Theme, auto-save
- **AI Providers**: OpenAI, Claude, Grok, Ollama
- **Editor**: Font size, font family, tab size
- **Shortcuts**: Customizable keyboard shortcuts

**Saving Settings**:
```tsx
// Settings are automatically loaded on mount
// Click "Save" button to persist
// Click "Reset" to restore defaults
```

### 5. Error Handling

The ErrorBoundary is already set up:

```tsx
// Wraps entire app in App.tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Custom fallback
<ErrorBoundary 
  fallback={(error, errorInfo, reset) => (
    <div>
      <h1>Custom Error UI</h1>
      <button onClick={reset}>Try Again</button>
    </div>
  )}
>
  <MyComponent />
</ErrorBoundary>
```

## 🎨 Styling Components

All components use Cortex design system:

```tsx
// Components automatically use CSS variables
// Defined in your global styles
:root {
  --background: ...;
  --text: ...;
  --accent: ...;
  --border: ...;
  --surface: ...;
}

// Components respect theme changes automatically
```

## 🔧 Customization

### Custom Toast Position

```tsx
// Edit toast.tsx line 103-104
<div className="fixed bottom-6 right-6 ...">  // Change position
```

### Custom Skeleton Animation

```tsx
// Edit skeleton.tsx line 14
const baseStyles = 'animate-pulse bg-surface';  // Change animation
```

### Custom Tutorial Steps

```tsx
// Edit InteractiveTutorial.tsx lines 11-88
const tutorialSteps: TutorialStep[] = [
  {
    title: 'Your Custom Step',
    description: 'Your description',
    canSkip: true,
    content: <YourCustomContent />,
  },
  // ... more steps
];
```

## 📱 Keyboard Shortcuts

Built-in shortcuts (configurable in Settings):
- `Cmd/Ctrl + B` - Toggle sidebar
- `Cmd/Ctrl + J` - Toggle terminal
- `Cmd/Ctrl + N` - New chat
- `Cmd/Ctrl + S` - Save file
- `Cmd/Ctrl + P` - Open command palette
- `Cmd/Ctrl + Shift + D` - Toggle debug panel

## 💾 Local Storage

Features use localStorage for persistence:

```
cortex:onboarding        - Onboarding state
cortex:settings          - User settings
cortex:skip-welcome      - Skip welcome flag
```

Clear all:
```tsx
localStorage.clear(); // Reset everything
```

## 🧪 Testing

Test components in isolation:

```tsx
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/toast';

test('toast notifications', () => {
  render(
    <ToastProvider>
      <MyComponent />
    </ToastProvider>
  );
  // ... test logic
});
```

## 🐛 Troubleshooting

### Toasts not showing?
- Ensure `<ToastProvider>` wraps your app
- Check z-index conflicts (toasts use z-100)

### Settings not saving?
- Check localStorage is available
- Check browser console for errors

### Onboarding not showing?
- Check localStorage key `cortex:skip-welcome`
- Call `resetOnboarding()` to force show

### Styles not applying?
- Ensure Tailwind CSS is properly configured
- Check CSS variables are defined

## 📚 Examples

See `/FEATURES_IMPLEMENTED.md` for:
- Complete feature documentation
- API reference
- Integration examples
- Best practices

## 🚀 Production Checklist

Before deploying:
- [ ] Test all toast types
- [ ] Complete tutorial flow
- [ ] Configure AI providers in settings
- [ ] Test error boundary
- [ ] Verify loading states
- [ ] Check keyboard shortcuts
- [ ] Test theme switching
- [ ] Verify localStorage persistence

## 💡 Tips

1. **Use toast sparingly** - Only for important feedback
2. **Show skeletons immediately** - Don't wait for data
3. **Keep tutorial short** - 5 steps maximum
4. **Provide defaults** - All settings should have sensible defaults
5. **Handle errors gracefully** - Always show user-friendly messages

## 🎯 Next Steps

After mastering the basics:
- Implement undo/redo system
- Add command palette (Cmd+K)
- Create more skeleton patterns
- Add custom keyboard shortcuts
- Implement optimistic updates
- Add confirmation dialogs
