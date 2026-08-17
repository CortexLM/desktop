/**
 * Accessibility Fixes - Critical Issues
 * Apply these fixes to achieve WCAG 2.1 AA compliance
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

// ============================================================================
// 1. ICON BUTTON WITH ARIA LABEL
// ============================================================================

// Before (BAD):
/*
<Button size="icon">
  <Send className="w-4 h-4" />
</Button>
*/

// After (GOOD):
/*
<Button size="icon" aria-label="Send message">
  <Send className="w-4 h-4" aria-hidden="true" />
</Button>
*/

// ============================================================================
// 2. FORM INPUT WITH LABEL
// ============================================================================

// Before (BAD):
/*
<input
  type="text"
  value={value}
  onChange={onChange}
  placeholder="Enter value..."
/>
*/

// After (GOOD):
/*
<div className="space-y-2">
  <label htmlFor="input-id" className="text-sm font-medium">
    Label Text
  </label>
  <input
    id="input-id"
    type="text"
    value={value}
    onChange={onChange}
    placeholder="Enter value..."
    aria-label="Label Text"
  />
</div>
*/

// ============================================================================
// 3. LOADING STATE WITH ANNOUNCEMENT
// ============================================================================

// Before (BAD):
/*
{isLoading && (
  <div>
    <Spinner />
    <span>Loading...</span>
  </div>
)}
*/

// After (GOOD):
/*
{isLoading && (
  <div role="status" aria-live="polite" className="flex items-center gap-2">
    <Spinner aria-hidden="true" />
    <span>Loading files...</span>
  </div>
)}
*/

// ============================================================================
// 4. ERROR MESSAGE WITH ARIA
// ============================================================================

// Before (BAD):
/*
{error && <div className="text-red">{error}</div>}
*/

// After (GOOD):
/*
{error && (
  <div role="alert" aria-live="assertive" className="text-red">
    {error}
  </div>
)}
*/

// ============================================================================
// 5. SKIP NAVIGATION LINK
// ============================================================================

export const SkipNavLink: React.FC = () => (
  <a
    href="#main-content"
    className={cn(
      'sr-only focus:not-sr-only',
      'focus:absolute focus:top-4 focus:left-4 focus:z-50',
      'focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground',
      'focus:rounded-sm focus:outline-none focus:ring-2 focus:ring-ring'
    )}
  >
    Skip to main content
  </a>
);

// Usage:
/*
<div className="app">
  <SkipNavLink />
  <header>...</header>
  <main id="main-content">...</main>
</div>
*/

// ============================================================================
// 6. CODE BLOCK WITH ACCESSIBILITY
// ============================================================================

export const AccessibleCodeBlock: React.FC<{
  code: string;
  language: string;
  onCopy?: () => void;
}> = ({ code, language, onCopy }) => (
  <div className="my-3">
    <div 
      className="flex items-center justify-between px-3 py-1.5 bg-elevated border-b border-border-dark rounded-t-sm"
      role="banner"
    >
      <span className="text-xs font-mono text-text-secondary">
        {language}
      </span>
      {onCopy && (
        <button
          onClick={onCopy}
          aria-label={`Copy ${language} code to clipboard`}
          className="text-xs text-text-secondary hover:text-text"
        >
          Copy
        </button>
      )}
    </div>
    <pre
      role="region"
      aria-label={`Code block in ${language}`}
      tabIndex={0}
      className="overflow-x-auto p-4 bg-elevated rounded-b-sm"
    >
      <code className={`language-${language}`}>
        {code}
      </code>
    </pre>
  </div>
);

// ============================================================================
// 7. FORM FIELD WITH ERROR HANDLING
// ============================================================================

export const AccessibleFormField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}> = ({ 
  id, 
  label, 
  value, 
  onChange, 
  error, 
  required = false,
  type = 'text',
  placeholder 
}) => {
  const errorId = `${id}-error`;
  const hasError = !!error;

  return (
    <div className="space-y-2">
      <label 
        htmlFor={id} 
        className="text-sm font-medium text-text"
      >
        {label}
        {required && (
          <span className="text-red ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={cn(
          'flex h-9 w-full rounded-sm border px-3 py-1 text-sm',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          hasError ? 'border-red' : 'border-border'
        )}
      />
      {hasError && (
        <span 
          id={errorId} 
          role="alert"
          className="text-sm text-red"
        >
          {error}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// 8. LIVE REGION FOR STREAMING CONTENT
// ============================================================================

export const StreamingAnnouncement: React.FC<{
  isStreaming: boolean;
  message: string;
}> = ({ isStreaming, message }) => {
  if (!isStreaming) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
};

// Usage in ChatView:
/*
<StreamingAnnouncement 
  isStreaming={isStreaming} 
  message="AI is generating a response"
/>
*/

// ============================================================================
// 9. LANDMARK STRUCTURE
// ============================================================================

export const AppLayout: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div className="h-screen w-screen flex flex-col">
    <SkipNavLink />
    
    <header 
      className="h-12 border-b border-border flex items-center px-4"
      role="banner"
    >
      {/* Header content */}
    </header>
    
    <main 
      id="main-content"
      className="flex-1 overflow-hidden"
      role="main"
    >
      {children}
    </main>
  </div>
);

// ============================================================================
// 10. ACCESSIBLE FILE TREE NODE
// ============================================================================

export const FileTreeNode: React.FC<{
  name: string;
  type: 'file' | 'directory';
  isExpanded?: boolean;
  onToggle?: () => void;
  onOpen?: () => void;
}> = ({ name, type, isExpanded, onToggle, onOpen }) => (
  <div
    role={type === 'directory' ? 'treeitem' : 'treeitem'}
    aria-expanded={type === 'directory' ? isExpanded : undefined}
    aria-label={`${type === 'directory' ? 'Folder' : 'File'}: ${name}`}
    tabIndex={0}
    onClick={type === 'directory' ? onToggle : onOpen}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        type === 'directory' ? onToggle?.() : onOpen?.();
      }
    }}
    className="flex items-center gap-2 px-2 py-1 hover:bg-tint cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
  >
    {type === 'directory' && (
      <span aria-hidden="true">
        {isExpanded ? '▼' : '▶'}
      </span>
    )}
    <span>{name}</span>
  </div>
);

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// In ChatView.tsx:
import { StreamingAnnouncement, AccessibleCodeBlock } from './accessibility-fixes';

// Add to component:
<StreamingAnnouncement 
  isStreaming={isStreaming} 
  message="AI is generating a response"
/>

// Replace code blocks with:
<AccessibleCodeBlock
  code={codeContent}
  language={language}
  onCopy={() => copyToClipboard(codeContent)}
/>
*/

/*
// Usage example - In App.tsx:
// import { AppLayout, SkipNavLink } from './accessibility-fixes';
//
// Wrap app content:
// <AppLayout>
//   {/-- Your app content --/}
// </AppLayout>
*/

/*
// In forms:
// import { AccessibleFormField } from './accessibility-fixes';
//
// <AccessibleFormField
//   id="repo-path"
//   label="Repository Path"
//   value={repoPath}
//   onChange={setRepoPath}
//   error={pathError}
//   required
// />
*/

export default {
  SkipNavLink,
  AccessibleCodeBlock,
  AccessibleFormField,
  StreamingAnnouncement,
  AppLayout,
  FileTreeNode,
};
