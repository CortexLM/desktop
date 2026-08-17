/**
 * EmptyState - what a panel shows when it has nothing to show.
 *
 * An empty panel leaves the user guessing whether it's broken, still loading,
 * or genuinely empty. This names the situation and offers the action that
 * resolves it, so "nothing here" always comes with a way forward.
 */

import * as React from 'react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export interface EmptyStateProps {
  /** Decorative glyph, e.g. `<Folder className="w-8 h-8" />`. */
  icon?: React.ReactNode;
  /** What's empty, in plain language. */
  title: string;
  /** One line on how to fill it. */
  description?: string;
  /** Primary way out of the empty state. */
  action?: EmptyStateAction;
  /** Alternative path, rendered as a lower-emphasis button. */
  secondaryAction?: EmptyStateAction;
  className?: string;
  'data-testid'?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  'data-testid': testId,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full w-full p-8 text-center',
        className
      )}
      data-testid={testId}
    >
      {icon && (
        <div
          className="w-16 h-16 rounded-full bg-wash border border-border flex items-center justify-center mb-4 text-text-tertiary"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      <h3 className="text-base font-semibold text-text mb-2">{title}</h3>

      {description && (
        <p className="text-sm text-text-secondary max-w-md mb-6">{description}</p>
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
              {secondaryAction.icon}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ErrorState - EmptyState's sibling for "we tried and it failed".
 *
 * Distinct from an empty state: this always offers a retry, because the panel
 * could have content and something went wrong fetching it.
 */
export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
  'data-testid'?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
  'data-testid': testId = 'error-state',
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full w-full p-8 text-center',
        className
      )}
      role="alert"
      data-testid={testId}
    >
      <div
        className="w-16 h-16 rounded-full bg-red-soft border border-red/30 flex items-center justify-center mb-4 text-red"
        aria-hidden="true"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h3 className="text-base font-semibold text-text mb-2">{title}</h3>
      <p className="text-sm text-text-secondary max-w-md mb-6 break-words">{message}</p>

      {onRetry && (
        <Button variant="outline" onClick={onRetry} data-testid="error-state-retry">
          Try again
        </Button>
      )}
    </div>
  );
}
