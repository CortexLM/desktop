/**
 * Toast Notification System - User feedback component
 */

import * as React from 'react';
import { CheckCircle2, AlertCircle, Info, X, TriangleAlert } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
}

/** Extra options for the `success`/`error`/`warning`/`info` shorthands. */
export interface ToastOptions {
  /** Renders an inline button in the toast, e.g. a "Retry" affordance. */
  action?: ToastAction;
  /** Override the default auto-dismiss delay, ms. Use 0 to require manual dismissal. */
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  success: (message: string, description?: string, options?: ToastOptions) => void;
  error: (message: string, description?: string, options?: ToastOptions) => void;
  warning: (message: string, description?: string, options?: ToastOptions) => void;
  info: (message: string, description?: string, options?: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = React.useCallback(
    (message: string, description?: string, options?: ToastOptions) => {
      addToast({ type: 'success', message, description, ...options });
    },
    [addToast]
  );

  const error = React.useCallback(
    (message: string, description?: string, options?: ToastOptions) => {
      addToast({ type: 'error', message, description, duration: 7000, ...options });
    },
    [addToast]
  );

  const warning = React.useCallback(
    (message: string, description?: string, options?: ToastOptions) => {
      addToast({ type: 'warning', message, description, duration: 6000, ...options });
    },
    [addToast]
  );

  const info = React.useCallback(
    (message: string, description?: string, options?: ToastOptions) => {
      addToast({ type: 'info', message, description, ...options });
    },
    [addToast]
  );

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

/**
 * Like useToast, but returns null instead of throwing when there is no
 * provider. Error-reporting code has to work even in trees that were mounted
 * without a ToastProvider (tests, isolated component screenshots), where
 * throwing would replace the real error with a confusing context error.
 */
export function useOptionalToast(): ToastContextValue | null {
  return React.useContext(ToastContext);
}

function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div
      className="fixed top-6 right-6 z-[100] flex flex-col gap-2 max-w-md pointer-events-none"
      // Screen readers announce arriving toasts without stealing focus.
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      data-testid="toast-container"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const [isExiting, setIsExiting] = React.useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      removeToast(toast.id);
    }, 200);
  };

  // Semantic tokens, not raw palette shades: `green-500`/`red-500` don't exist
  // in this theme (tailwind.config.js maps `green`/`red` to design tokens), so
  // those classes emitted nothing and every toast rendered colourless.
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0" aria-hidden="true" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red flex-shrink-0" aria-hidden="true" />;
      case 'warning':
        return <TriangleAlert className="w-5 h-5 text-amber flex-shrink-0" aria-hidden="true" />;
      case 'info':
        return <Info className="w-5 h-5 text-accent flex-shrink-0" aria-hidden="true" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green/50';
      case 'error':
        return 'border-red/50';
      case 'warning':
        return 'border-amber/50';
      case 'info':
        return 'border-accent/50';
    }
  };

  return (
    <div
      className={`
        pointer-events-auto
        bg-background/95 backdrop-blur-sm
        border ${getBorderColor()}
        rounded-lg shadow-lg
        p-4 pr-12
        transform transition-all duration-200
        ${isExiting ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
      data-testid={`toast-${toast.type}`}
    >
      <div className="flex gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text">
            {toast.message}
          </div>
          {toast.description && (
            <div className="text-xs text-text-secondary mt-1 break-words">
              {toast.description}
            </div>
          )}
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick();
                handleClose();
              }}
              className="text-xs text-accent hover:text-accent/80 mt-2 font-medium rounded-xs"
              data-testid="toast-action"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-text-secondary hover:text-text transition-colors rounded-xs"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
