/**
 * Global error handlers - Catch unhandled errors and promise rejections
 */

import { logger } from '@cortex-ide/shared/logger';
import type { ErrorReport } from '@cortex-ide/shared/types/debug';

/**
 * Setup global error handlers
 */
export function setupErrorHandlers(): void {
  // Unhandled errors
  window.addEventListener('error', (event) => {
    const report: ErrorReport = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      message: event.message,
      stack: event.error?.stack || '',
      source: 'renderer',
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        userAgent: navigator.userAgent
      },
      severity: 'critical'
    };

    // The full report is logged, not just message+error: it carries the
    // severity and the source location that were previously discarded.
    logger.error('global', 'Unhandled error', report);

    // Prevent default browser error handling
    event.preventDefault();
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const report: ErrorReport = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack || '',
      source: 'renderer',
      context: {
        reason: event.reason,
        userAgent: navigator.userAgent
      },
      severity: 'high'
    };

    logger.error('global', 'Unhandled promise rejection', report);

    // Prevent default browser handling
    event.preventDefault();
  });

  logger.info('error-handler', 'Global error handlers initialized');
}

/**
 * Manual error reporting
 */
export function reportError(
  error: Error,
  context?: Record<string, any>,
  severity: ErrorReport['severity'] = 'medium'
): void {
  const report: ErrorReport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    message: error.message,
    stack: error.stack || '',
    source: 'renderer',
    context: {
      ...context,
      userAgent: navigator.userAgent,
      location: window.location.href
    },
    severity
  };

  logger.error('manual', 'Manual error report', report);
}
