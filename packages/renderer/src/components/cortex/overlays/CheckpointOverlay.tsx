import * as React from 'react';

export function CheckpointOverlay({
  onClose,
  onRestore,
}: {
  onClose: () => void;
  onRestore: (id: string) => void;
}) {
  const [items, setItems] = React.useState<Array<{ id: string; label: string; createdAt: number }>>([]);

  React.useEffect(() => {
    void window.ipc
      .invoke('ai:list-checkpoints')
      .then((response: { success?: boolean; data?: { checkpoints?: Array<{ id: string; label: string; createdAt: number }> } }) => {
        if (response?.data?.checkpoints) setItems(response.data.checkpoints);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/40" data-testid="checkpoint-overlay">
      <div className="w-[420px] rounded-[10px] border border-border bg-elevated p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-medium">Restore checkpoint</h2>
          <button type="button" onClick={onClose} className="text-[12px] text-text-tertiary">
            Close
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-[13px] text-text-secondary">No checkpoints in this session yet.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full text-left px-2 py-2 rounded-md hover:bg-tint text-[13px]"
                  onClick={() => onRestore(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const rows = [
    ['⌘K / ⌘P', 'Command palette / Quick open'],
    ['⌘J', 'Terminal'],
    ['Esc', 'Interrupt agent'],
    ['⌘B', 'Toggle sidebar'],
    ['⌘,', 'Settings'],
  ];
  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/40" data-testid="shortcuts-overlay">
      <div className="w-[420px] rounded-[10px] border border-border bg-elevated p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-medium">Shortcuts</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <dl className="space-y-2">
          {rows.map(([key, label]) => (
            <div key={key} className="flex justify-between text-[13px]">
              <dt className="font-mono text-text-secondary">{key}</dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
