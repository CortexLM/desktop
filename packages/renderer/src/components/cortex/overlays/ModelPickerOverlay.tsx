import { RECOMMENDED_MODELS } from '@cortex-ide/ai-engine';

const PROVIDERS = ['anthropic', 'openai', 'openrouter', 'ollama'] as const;

export function ModelPickerOverlay({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (model: string, provider: (typeof PROVIDERS)[number]) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[1050] flex items-start justify-center pt-24 bg-black/40" data-testid="model-picker">
      <div className="w-[480px] rounded-[10px] border border-border bg-elevated p-3 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-medium">Model</h2>
          <button type="button" onClick={onClose} className="text-[12px] text-text-tertiary">
            Close
          </button>
        </div>
        <div className="max-h-[360px] overflow-auto space-y-3">
          {PROVIDERS.map((provider) => (
            <div key={provider}>
              <div className="text-[11px] uppercase text-text-tertiary px-1 mb-1">{provider}</div>
              {(RECOMMENDED_MODELS[provider] ?? []).map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => onChange(model.id, provider)}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-[13px] ${
                    value === model.id ? 'bg-tint-strong' : 'hover:bg-tint'
                  }`}
                >
                  {model.name ?? model.id}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
