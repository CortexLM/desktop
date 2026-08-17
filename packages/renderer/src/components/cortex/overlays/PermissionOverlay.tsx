import * as React from 'react';
import type { StreamPermissionPayload } from '@cortex-ide/shared';

export function PermissionOverlay({
  request,
  onDecide,
}: {
  request: StreamPermissionPayload;
  onDecide: (decision: 'allow-once' | 'allow-always' | 'deny') => void;
}) {
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onDecide('allow-once');
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onDecide('deny');
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onDecide]);

  return (
    <div className="flex flex-col gap-2" data-testid="permission-overlay">
      <div className="rounded-[10px] border border-border bg-elevated px-[13px] py-3">
        <div className="text-[13px] font-medium mb-2">Permission needed</div>
        <pre className="font-mono text-[12px] bg-page border border-border rounded-md px-2 py-2 overflow-auto max-h-28 mb-2 text-text">
          {request.detail || request.summary || request.tool}
        </pre>
        <p className="text-[13px] text-text-secondary mb-3">
          {request.summary || `Allow ${request.tool}?`}
        </p>
        <div className="flex items-center justify-end gap-2">
          <GhostButton onClick={() => onDecide('deny')}>Deny</GhostButton>
          <GhostButton onClick={() => onDecide('allow-once')}>Allow once</GhostButton>
          <GhostButton onClick={() => onDecide('allow-always')}>Always allow</GhostButton>
        </div>
      </div>
      <div className="flex items-center justify-between px-1">
        <span className="text-[12px] text-text-secondary">Paused — waiting for approval</span>
        <span className="font-mono text-[10px] text-text-tertiary">↵ allow · esc deny</span>
      </div>
    </div>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 px-2.5 rounded-[6px] text-[13px] text-text hover:bg-tint"
    >
      {children}
    </button>
  );
}
