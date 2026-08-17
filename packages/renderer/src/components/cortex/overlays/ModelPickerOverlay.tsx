import * as React from 'react';
import { RECOMMENDED_MODELS } from '@cortex-ide/ai-engine';

const PROVIDERS = ['anthropic', 'openai', 'openrouter', 'ollama'] as const;

export function ModelPickerOverlay({
  value,
  anchorRef,
  onChange,
  onClose,
  onManage,
}: {
  value: string;
  anchorRef?: React.RefObject<HTMLElement>;
  onChange: (model: string, provider: (typeof PROVIDERS)[number]) => void;
  onClose: () => void;
  onManage?: () => void;
}) {
  const [query, setQuery] = React.useState('');
  const [pos, setPos] = React.useState({ top: 120, left: 24 });

  React.useLayoutEffect(() => {
    const el = anchorRef?.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 310;
    setPos({
      top: Math.max(8, rect.top - 8 - 360),
      left: Math.max(8, rect.right - width),
    });
  }, [anchorRef]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-testid="model-picker"]')) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [anchorRef, onClose]);

  const q = query.trim().toLowerCase();

  return (
    <div
      className="fixed z-[1060] w-[310px] rounded-[10px] border border-border bg-elevated shadow-overlay overflow-hidden"
      style={{ top: pos.top, left: pos.left }}
      data-testid="model-picker"
      role="dialog"
      aria-label="Model"
    >
      <input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search models"
        className="w-full h-9 px-3 bg-transparent text-[13px] outline-none border-b border-border placeholder:text-text-tertiary"
        data-testid="model-picker-search"
      />
      <div className="max-h-[280px] overflow-auto py-1">
        {PROVIDERS.map((provider) => {
          const models = (RECOMMENDED_MODELS[provider] ?? []).filter((model) => {
            if (!q) return true;
            return (
              model.id.toLowerCase().includes(q) ||
              (model.name ?? '').toLowerCase().includes(q) ||
              provider.includes(q)
            );
          });
          if (models.length === 0) return null;
          return (
            <div key={provider}>
              <div className="h-6 px-2 flex items-center text-[11px] uppercase text-text-tertiary">
                {provider}
              </div>
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => onChange(model.id, provider)}
                  className={`w-full h-8 px-2 text-left text-[13px] truncate ${
                    value === model.id ? 'bg-tint-strong' : 'hover:bg-tint'
                  }`}
                >
                  {model.name ?? model.id}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onManage}
        className="w-full h-8 px-3 text-left text-[13px] text-accent border-t border-border"
      >
        Manage models…
      </button>
    </div>
  );
}
