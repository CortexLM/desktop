export function ContextFullBanner({ onCompact }: { onCompact: () => void }) {
  return (
    <div className="h-9 px-4 flex items-center justify-between bg-amber-soft text-[12px]" data-testid="context-full">
      <span>Context window is full. Compact or start a new session to continue.</span>
      <button type="button" className="underline" onClick={onCompact}>
        Compact
      </button>
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div className="h-9 px-4 flex items-center bg-red-soft text-[12px]" data-testid="offline-banner">
      You are offline. Local tools still work; providers will fail until the network returns.
    </div>
  );
}

export function ProviderErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="h-9 px-4 flex items-center justify-between bg-red-soft text-[12px]" data-testid="provider-error">
      <span>Provider error: {message}</span>
      <button type="button" onClick={onDismiss} className="underline">
        Dismiss
      </button>
    </div>
  );
}
