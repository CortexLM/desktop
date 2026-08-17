import type { StreamPermissionPayload } from '@cortex-ide/shared';

export function PermissionOverlay({
  request,
  onDecide,
}: {
  request: StreamPermissionPayload;
  onDecide: (decision: 'allow-once' | 'allow-always' | 'deny') => void;
}) {
  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/50" data-testid="permission-overlay">
      <div className="w-[420px] rounded-[10px] border border-border bg-elevated p-4 shadow-lg">
        <div className="text-[13px] text-text-tertiary mb-1">Permission</div>
        <h2 className="text-[16px] font-medium mb-2">Allow {request.tool}?</h2>
        <p className="text-[13px] text-text-secondary mb-1">{request.summary}</p>
        {request.detail && (
          <pre className="text-[12px] font-mono bg-page border border-border rounded-md p-2 overflow-auto max-h-32 mb-4">
            {request.detail}
          </pre>
        )}
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="h-8 px-3 rounded-md border border-border text-[13px]" onClick={() => onDecide('deny')}>
            Deny
          </button>
          <button type="button" className="h-8 px-3 rounded-md border border-border text-[13px]" onClick={() => onDecide('allow-once')}>
            Allow once
          </button>
          <button
            type="button"
            className="h-8 px-3 rounded-md bg-accent text-page text-[13px]"
            onClick={() => onDecide('allow-always')}
          >
            Always allow
          </button>
        </div>
      </div>
    </div>
  );
}
