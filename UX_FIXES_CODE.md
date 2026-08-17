# UX Fixes - Code Ready to Ship

Ce document contient le code prêt à copier-coller pour les fixes prioritaires.

---

## 🚀 Fix #1: App Shell avec Sidebar (2h)

### Créer `packages/renderer/src/components/layout/AppShell.tsx`

```tsx
/**
 * AppShell - Main application layout
 * Provides: Header, Sidebar, Main Content, Status Bar
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { 
  FiFolder, 
  FiGitBranch, 
  FiPackage, 
  FiSearch,
  FiMessageSquare,
  FiSettings,
  FiBug 
} from 'react-icons/fi';

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  statusBar?: React.ReactNode;
}

export function AppShell({ children, sidebar, statusBar }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  // Keyboard shortcut: Cmd+B to toggle sidebar
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-text">
      {/* Header */}
      <AppHeader />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'border-r border-border bg-elevated transition-all duration-200',
            sidebarCollapsed ? 'w-0' : 'w-[280px]'
          )}
        >
          {!sidebarCollapsed && (
            <div className="h-full overflow-hidden">
              {sidebar}
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      {/* Status Bar */}
      {statusBar && (
        <footer className="h-6 border-t border-border bg-elevated px-3 flex items-center justify-between text-xs text-text-secondary">
          {statusBar}
        </footer>
      )}
    </div>
  );
}

function AppHeader() {
  const [showSettings, setShowSettings] = React.useState(false);
  const [debugEnabled, setDebugEnabled] = React.useState(false);

  return (
    <header 
      role="banner"
      className="h-12 border-b border-border flex items-center px-4 gap-3 bg-elevated"
    >
      {/* Logo / Workspace Name */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 bg-accent rounded-sm flex items-center justify-center text-white text-xs font-bold">
          C
        </div>
        <h1 className="text-sm font-semibold truncate">
          Cortex IDE
        </h1>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* AI Chat */}
        <Tooltip content="Start AI chat (Cmd+L)">
          <Button size="sm" variant="primary">
            <FiMessageSquare className="w-4 h-4" />
            Ask AI
          </Button>
        </Tooltip>

        {/* Settings */}
        <Tooltip content="Settings (Cmd+,)">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Open settings"
          >
            <FiSettings className="w-4 h-4" />
          </Button>
        </Tooltip>

        {/* Debug Toggle */}
        <Tooltip content={debugEnabled ? "Disable debug mode" : "Enable debug mode"}>
          <Button
            size="sm"
            variant={debugEnabled ? "secondary" : "ghost"}
            onClick={() => setDebugEnabled(!debugEnabled)}
            aria-label={debugEnabled ? "Disable debug mode" : "Enable debug mode"}
          >
            <FiBug className="w-4 h-4" />
            {debugEnabled && <span className="ml-1">Debug</span>}
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}

/**
 * Sidebar Navigation Component
 */
export function SidebarNav() {
  const [activeView, setActiveView] = React.useState<'files' | 'git' | 'search' | 'extensions'>('files');

  const views = [
    { id: 'files' as const, icon: FiFolder, label: 'Files', shortcut: 'Cmd+Shift+E' },
    { id: 'git' as const, icon: FiGitBranch, label: 'Git', shortcut: 'Cmd+Shift+G' },
    { id: 'search' as const, icon: FiSearch, label: 'Search', shortcut: 'Cmd+Shift+F' },
    { id: 'extensions' as const, icon: FiPackage, label: 'Extensions', shortcut: 'Cmd+Shift+X' },
  ];

  return (
    <div className="h-full flex">
      {/* Icon Bar */}
      <div className="w-12 border-r border-border bg-page flex flex-col items-center py-2 gap-1">
        {views.map((view) => {
          const Icon = view.icon;
          return (
            <Tooltip key={view.id} content={`${view.label} (${view.shortcut})`} side="right">
              <Button
                size="icon"
                variant={activeView === view.id ? "secondary" : "ghost"}
                onClick={() => setActiveView(view.id)}
                aria-label={view.label}
                className="w-10 h-10"
              >
                <Icon className="w-5 h-5" />
              </Button>
            </Tooltip>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* View Title */}
        <div className="h-10 border-b border-border px-4 flex items-center">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {views.find(v => v.id === activeView)?.label}
          </h2>
        </div>

        {/* View Content */}
        <div className="flex-1 overflow-auto">
          {activeView === 'files' && <div className="p-3">File Explorer</div>}
          {activeView === 'git' && <div className="p-3">Git Panel</div>}
          {activeView === 'search' && <div className="p-3">Search Panel</div>}
          {activeView === 'extensions' && <div className="p-3">Extensions</div>}
        </div>
      </div>
    </div>
  );
}
```

---

## 🚀 Fix #2: Command Palette (3h)

### Créer `packages/renderer/src/components/CommandPalette.tsx`

```tsx
/**
 * Command Palette - Universal search and command execution
 * Shortcuts: Cmd+P (files), Cmd+Shift+P (commands)
 */

import * as React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FiFile, FiCommand, FiClock, FiArrowRight } from 'react-icons/fi';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  action: () => void;
  category?: string;
}

interface CommandPaletteProps {
  commands: Command[];
  files?: { path: string; name: string }[];
}

export function CommandPalette({ commands, files = [] }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [mode, setMode] = React.useState<'commands' | 'files'>('commands');
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setMode(e.shiftKey ? 'commands' : 'files');
        setOpen(true);
        setQuery('');
        setSelectedIndex(0);
      }
      
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Filter items
  const filteredCommands = React.useMemo(() => {
    if (mode !== 'commands' || !query) return commands;
    
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery))
    );
  }, [commands, query, mode]);

  const filteredFiles = React.useMemo(() => {
    if (mode !== 'files' || !query) return files;
    
    const lowerQuery = query.toLowerCase();
    return files.filter(file =>
      file.name.toLowerCase().includes(lowerQuery) ||
      file.path.toLowerCase().includes(lowerQuery)
    );
  }, [files, query, mode]);

  const items = mode === 'commands' ? filteredCommands : filteredFiles;

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      e.preventDefault();
      if (mode === 'commands') {
        (items[selectedIndex] as Command).action();
      } else {
        // Open file
        console.log('Open file:', (items[selectedIndex] as typeof files[0]).path);
      }
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Search Input */}
        <div className="p-4 border-b border-border">
          <Input
            placeholder={mode === 'files' ? 'Search files...' : 'Search commands...'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            className="border-0 focus-visible:ring-0 text-base"
          />
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              No results found for "{query}"
            </div>
          ) : (
            <div role="listbox">
              {mode === 'commands' && (filteredCommands as Command[]).map((cmd, index) => (
                <CommandItem
                  key={cmd.id}
                  command={cmd}
                  selected={index === selectedIndex}
                  onClick={() => {
                    cmd.action();
                    setOpen(false);
                  }}
                />
              ))}
              {mode === 'files' && filteredFiles.map((file, index) => (
                <FileItem
                  key={file.path}
                  file={file}
                  selected={index === selectedIndex}
                  onClick={() => {
                    console.log('Open:', file.path);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs text-text-secondary bg-wash">
          <div className="flex items-center gap-4">
            <kbd className="px-1.5 py-0.5 bg-elevated border border-border rounded text-[10px]">↑↓</kbd>
            <span>Navigate</span>
            <kbd className="px-1.5 py-0.5 bg-elevated border border-border rounded text-[10px]">↵</kbd>
            <span>Select</span>
            <kbd className="px-1.5 py-0.5 bg-elevated border border-border rounded text-[10px]">Esc</kbd>
            <span>Close</span>
          </div>
          <div>
            {mode === 'files' ? 'Cmd+P' : 'Cmd+Shift+P'}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommandItem({ 
  command, 
  selected, 
  onClick 
}: { 
  command: Command; 
  selected: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
        selected ? 'bg-accent/10' : 'hover:bg-tint'
      )}
    >
      <div className="w-8 h-8 rounded-sm bg-elevated border border-border flex items-center justify-center">
        {command.icon || <FiCommand className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text">{command.label}</div>
        {command.description && (
          <div className="text-xs text-text-secondary truncate">{command.description}</div>
        )}
      </div>
      <FiArrowRight className="w-4 h-4 text-text-tertiary" />
    </button>
  );
}

function FileItem({ 
  file, 
  selected, 
  onClick 
}: { 
  file: { path: string; name: string }; 
  selected: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
        selected ? 'bg-accent/10' : 'hover:bg-tint'
      )}
    >
      <FiFile className="w-4 h-4 text-text-secondary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text">{file.name}</div>
        <div className="text-xs text-text-tertiary truncate">{file.path}</div>
      </div>
    </button>
  );
}
```

---

## 🚀 Fix #3: Better Error Handling (1h)

### Créer `packages/renderer/src/hooks/use-error-handler.ts`

```ts
/**
 * useErrorHandler - Global error handling hook
 */

import { useCallback } from 'react';
import { toast } from '@/components/ui/toast';

interface ErrorHandlerOptions {
  title?: string;
  showToast?: boolean;
  retry?: () => void;
  onError?: (error: Error) => void;
}

export function useErrorHandler() {
  const handleError = useCallback((
    error: unknown,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      title = 'An error occurred',
      showToast = true,
      retry,
      onError,
    } = options;

    // Parse error
    const message = error instanceof Error ? error.message : String(error);
    
    // Log to console
    console.error(`[ErrorHandler] ${title}:`, error);
    
    // Call custom handler
    onError?.(error instanceof Error ? error : new Error(message));
    
    // Show toast
    if (showToast) {
      toast.error(title, {
        description: message,
        action: retry ? {
          label: 'Retry',
          onClick: retry,
        } : undefined,
      });
    }
    
    return {
      title,
      message,
      error,
    };
  }, []);

  return { handleError };
}

/**
 * Retry helper with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        onRetry?.(attempt + 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### Mise à jour `ChatView.tsx` avec error handling

```tsx
// Dans ChatView.tsx, remplacer la gestion d'erreur:

import { useErrorHandler, retryWithBackoff } from '@/hooks/use-error-handler';

export const ChatView: React.FC<ChatViewProps> = ({ sessionId, model }) => {
  const { handleError } = useErrorHandler();
  
  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    // ... existing code ...

    try {
      abortControllerRef.current = new AbortController();

      // Retry avec backoff
      await retryWithBackoff(
        async () => {
          const response = await window.cortex.ai.streamResponse({
            sessionId,
            message: userMessage.content,
            signal: abortControllerRef.current?.signal,
          });
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to send message');
          }
          
          return response;
        },
        {
          maxRetries: 2,
          initialDelay: 1000,
          onRetry: (attempt) => {
            toast.info('Retrying...', {
              description: `Attempt ${attempt} of 2`,
            });
          },
        }
      );

      // Handle streaming chunks
      window.electron.ipcRenderer.on('ai:stream-chunk', (_event, chunk) => {
        if (chunk.type === 'chunk' && chunk.content) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + chunk.content }
                : msg
            )
          );
        } else if (chunk.type === 'done') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, isStreaming: false }
                : msg
            )
          );
          setIsStreaming(false);
          setStreamingMessageId(null);
        } else if (chunk.type === 'error') {
          handleError(new Error(chunk.error), {
            title: 'AI Response Failed',
            retry: () => handleSend(),
          });
          
          // Add error message visibly in chat
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'system',
              content: `⚠️ Failed to generate response: ${chunk.error}`,
              timestamp: Date.now(),
            },
          ]);
          
          setIsStreaming(false);
          setStreamingMessageId(null);
        }
      });
    } catch (error) {
      handleError(error, {
        title: 'Failed to send message',
        retry: () => handleSend(),
      });
      
      setIsStreaming(false);
      setStreamingMessageId(null);
    }
  };

  // ... rest of component
};
```

---

## 🚀 Fix #4: Input Validation (30min)

### Créer `packages/renderer/src/components/ValidatedInput.tsx`

```tsx
/**
 * ValidatedInput - Input with built-in validation
 */

import * as React from 'react';
import { Input, InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FiAlertCircle, FiCheck } from 'react-icons/fi';

interface ValidatedInputProps extends Omit<InputProps, 'onChange'> {
  label?: string;
  validate?: (value: string) => string | null;
  onChange?: (value: string, isValid: boolean) => void;
  onValidChange?: (value: string) => void;
}

export const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ label, validate, onChange, onValidChange, className, ...props }, ref) => {
    const [value, setValue] = React.useState(props.value?.toString() || '');
    const [error, setError] = React.useState<string | null>(null);
    const [touched, setTouched] = React.useState(false);

    const isValid = !error && touched;

    React.useEffect(() => {
      if (touched && validate) {
        const validationError = validate(value);
        setError(validationError);
        
        if (!validationError) {
          onValidChange?.(value);
        }
      }
    }, [value, validate, touched, onValidChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      setTouched(true);
      
      const validationError = validate ? validate(newValue) : null;
      setError(validationError);
      
      onChange?.(newValue, !validationError);
    };

    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-text">
            {label}
            {props.required && <span className="text-red ml-1" aria-label="required">*</span>}
          </label>
        )}
        
        <div className="relative">
          <Input
            {...props}
            ref={ref}
            value={value}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            aria-invalid={!!error}
            aria-describedby={error ? `${props.id}-error` : undefined}
            className={cn(
              className,
              error && 'border-red focus-visible:ring-red',
              isValid && 'border-green'
            )}
          />
          
          {touched && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {error ? (
                <FiAlertCircle className="w-4 h-4 text-red" aria-hidden="true" />
              ) : (
                <FiCheck className="w-4 h-4 text-green" aria-hidden="true" />
              )}
            </div>
          )}
        </div>
        
        {error && touched && (
          <div 
            id={`${props.id}-error`}
            role="alert"
            className="text-xs text-red flex items-center gap-1"
          >
            <FiAlertCircle className="w-3 h-3" />
            {error}
          </div>
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';

/**
 * Common validators
 */
export const validators = {
  required: (message = 'This field is required') => (value: string) => {
    return value.trim() === '' ? message : null;
  },

  minLength: (min: number, message?: string) => (value: string) => {
    return value.length < min 
      ? message || `Must be at least ${min} characters` 
      : null;
  },

  maxLength: (max: number, message?: string) => (value: string) => {
    return value.length > max 
      ? message || `Must be at most ${max} characters` 
      : null;
  },

  pattern: (pattern: RegExp, message: string) => (value: string) => {
    return !pattern.test(value) ? message : null;
  },

  email: (message = 'Invalid email address') => (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !emailRegex.test(value) ? message : null;
  },

  path: (message = 'Invalid file path') => (value: string) => {
    // Basic path validation
    if (!value.trim()) return message;
    if (value.includes('..')) return 'Path cannot contain ".."';
    return null;
  },

  compose: (...validators: Array<(value: string) => string | null>) => (value: string) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return null;
  },
};
```

### Utilisation dans App.tsx

```tsx
// Remplacer l'input repo path par:

<ValidatedInput
  id="repo-path"
  label="Repository Path"
  placeholder="/path/to/your/project"
  value={repoPath}
  validate={validators.compose(
    validators.required('Repository path is required'),
    validators.path()
  )}
  onValidChange={(path) => {
    setRepoPath(path);
    // Optionally validate that it's a git repo
    window.cortex.git.isRepo(path).then(isRepo => {
      if (!isRepo) {
        toast.warning('Not a Git repository', {
          description: 'The selected path is not a Git repository.',
        });
      }
    });
  }}
/>
```

---

## 🚀 Fix #5: Empty States (30min)

### Créer `packages/renderer/src/components/EmptyState.tsx`

```tsx
/**
 * EmptyState - Reusable empty state component
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-wash border border-border flex items-center justify-center mb-4 text-text-tertiary">
          {icon}
        </div>
      )}
      
      <h3 className="text-base font-semibold text-text mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-text-secondary max-w-md mb-6">
          {description}
        </p>
      )}
      
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <Button onClick={action.onClick}>
              {action.icon}
              {action.label}
            </Button>
          )}
          
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

### Exemples d'utilisation

```tsx
// No files open
<EmptyState
  icon={<FiFolder className="w-8 h-8" />}
  title="No files open"
  description="Open a file or folder to get started with Cortex IDE"
  action={{
    label: 'Open Folder',
    onClick: handleOpenFolder,
    icon: <FiFolder className="w-4 h-4 mr-2" />,
  }}
  secondaryAction={{
    label: 'Open File',
    onClick: handleOpenFile,
  }}
/>

// No Git repository
<EmptyState
  icon={<FiGitBranch className="w-8 h-8" />}
  title="No Git repository"
  description="Initialize a Git repository or open an existing one to use Git features"
  action={{
    label: 'Initialize Git',
    onClick: handleInitGit,
  }}
  secondaryAction={{
    label: 'Open Repository',
    onClick: handleOpenRepo,
  }}
/>

// No AI sessions
<EmptyState
  icon={<FiMessageSquare className="w-8 h-8" />}
  title="Start your first AI chat"
  description="Ask questions, generate code, or get help with your project"
  action={{
    label: 'New Chat Session',
    onClick: handleNewChat,
    icon: <FiPlus className="w-4 h-4 mr-2" />,
  }}
/>
```

---

## 📝 Integration Checklist

### App.tsx Refactor

```tsx
// New App.tsx structure

import { AppShell, SidebarNav } from '@/components/layout/AppShell';
import { CommandPalette } from '@/components/CommandPalette';
import { EmptyState } from '@/components/EmptyState';

export default function App() {
  const [workspace, setWorkspace] = React.useState<string | null>(null);

  if (!workspace) {
    return (
      <EmptyState
        icon={<FiFolder className="w-8 h-8" />}
        title="Welcome to Cortex IDE"
        description="Open a folder to get started"
        action={{
          label: 'Open Folder',
          onClick: handleOpenFolder,
        }}
        secondaryAction={{
          label: 'Clone Repository',
          onClick: handleCloneRepo,
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <DebugProvider>
          <AppShell
            sidebar={<SidebarNav />}
            statusBar={<StatusBar workspace={workspace} />}
          >
            <MainContent />
          </AppShell>
          
          <CommandPalette commands={commands} files={files} />
          <UpdateNotification />
          <WelcomeScreen />
        </DebugProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
```

---

## ⚡ Quick Wins (< 15min each)

### 1. Fix emoji buttons

```tsx
// Before
<button>⚙️ Settings</button>

// After
<Button>
  <Settings className="w-4 h-4" />
  Settings
</Button>
```

### 2. Fix focus ring

```css
/* In tokens.css */
*:focus-visible {
  outline: 2px solid var(--color-ring);  /* Changed from 1px */
  outline-offset: 2px;  /* Changed from 1px */
}
```

### 3. Fix scrollbar

```css
/* In tokens.css */
::-webkit-scrollbar {
  width: 14px;   /* Changed from 10px */
  height: 14px;  /* Changed from 10px */
}
```

### 4. Add transitions utility

```css
/* In globals.css */
.transition-colors {
  transition-property: color, background-color, border-color;
  transition-duration: var(--transition-fast);
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 5. Add aria-labels

```tsx
// Search all icon-only buttons and add aria-label
<Button size="icon" aria-label="Close dialog">
  <X className="w-4 h-4" />
</Button>
```

---

**Temps total estimé pour ces 5 fixes majeurs:** 8-10 heures  
**Impact:** Transformation massive de l'UX  
**Priorité:** Critique - À faire IMMÉDIATEMENT
