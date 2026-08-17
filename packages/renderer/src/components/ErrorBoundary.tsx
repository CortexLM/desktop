/**
 * Error Boundary - Catch and report React errors
 */

import * as React from 'react';
import { logger } from '@cortex-ide/shared/logger';
import type { ErrorReport } from '@cortex-ide/shared/types/debug';
import { Button } from './ui/button';
import { FiAlertTriangle, FiRefreshCw, FiCopy } from 'react-icons/fi';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, errorInfo: React.ErrorInfo, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Log error
    logger.error('react', 'Component error caught by boundary', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });

    // Report error
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: React.ErrorInfo) {
    const report: ErrorReport = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack || '',
      componentStack: errorInfo.componentStack || undefined,
      source: 'renderer',
      context: {
        userAgent: navigator.userAgent,
        location: window.location.href
      },
      severity: 'high'
    };

    // Could send to error tracking service here (Sentry, etc.)
    console.error('Error Report:', report);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    if (!error) return;

    const errorText = `
Error: ${error.message}

Stack Trace:
${error.stack}

Component Stack:
${errorInfo?.componentStack}
    `.trim();

    navigator.clipboard.writeText(errorText);
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, errorInfo!, this.handleReset);
      }

      return (
        <div className="h-full flex items-center justify-center bg-background p-8">
          <div className="max-w-2xl w-full">
            <div className="bg-red-500/10 border-2 border-red-500/50 rounded-lg p-6">
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <FiAlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-red-500 mb-1">
                    Something went wrong
                  </h2>
                  <p className="text-sm text-text-secondary">
                    An unexpected error occurred in the application
                  </p>
                </div>
              </div>

              {/* Error Message */}
              <div className="bg-background rounded border border-border p-4 mb-4">
                <div className="text-sm font-medium text-red-400 mb-2">
                  {error.message}
                </div>
                {error.stack && (
                  <pre className="text-xs text-text-secondary overflow-auto max-h-40 font-mono">
                    {error.stack}
                  </pre>
                )}
              </div>

              {/* Component Stack */}
              {errorInfo?.componentStack && (
                <details className="mb-4">
                  <summary className="text-sm font-medium text-text cursor-pointer hover:text-accent">
                    Component Stack
                  </summary>
                  <pre className="mt-2 text-xs text-text-secondary overflow-auto max-h-40 bg-background rounded border border-border p-3 font-mono">
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={this.handleReset}
                  className="flex-1"
                >
                  <FiRefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleCopyError}
                >
                  <FiCopy className="w-4 h-4 mr-2" />
                  Copy Error
                </Button>
              </div>

              <p className="text-xs text-text-secondary mt-4 text-center">
                If this problem persists, please report it to the development team
              </p>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
