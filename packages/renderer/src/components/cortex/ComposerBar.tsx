import * as React from 'react';
import { ArrowUp, ChevronDown, Plus, Square } from 'lucide-react';

export function ComposerBar({
  running,
  mode,
  modelLabel,
  modelButtonRef,
  onModeChange,
  onSubmit,
  onStop,
  onOpenModelPicker,
}: {
  running: boolean;
  mode: 'agent' | 'plan' | 'mission' | 'ask';
  modelLabel: string;
  modelButtonRef?: React.Ref<HTMLButtonElement>;
  onModeChange: (mode: 'agent' | 'plan' | 'mission' | 'ask') => void;
  onSubmit: (text: string) => void;
  onStop: () => void;
  onOpenModelPicker?: () => void;
}) {
  const [value, setValue] = React.useState('');
  const ready = value.trim().length > 0;
  const placeholder = running
    ? 'Queue a follow-up while the agent works...'
    : '@ for files and agents · / for commands and skills · ! for shell · # for snippets';

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onSubmit(text);
    setValue('');
  };

  return (
    <div
      className="rounded-[12px] border border-border bg-elevated px-3 pt-3 pb-2 flex flex-col gap-4"
      data-testid="composer"
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none bg-transparent text-[13px] outline-none placeholder:text-text-tertiary"
        data-testid="composer-input"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-tertiary">
          <button type="button" aria-label="Attach" className="p-1" data-testid="composer-attach">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {/* Paper: Agent chip sits in the right group, and only the model +
              stop remain while a turn is running. */}
          {!running && (
            <>
              <label className="sr-only" htmlFor="agent-mode">
                Agent mode
              </label>
              <div className="relative">
                <select
                  id="agent-mode"
                  value={mode}
                  onChange={(event) => onModeChange(event.target.value as typeof mode)}
                  className="h-[26px] pl-2 pr-6 rounded-full border border-border bg-elevated text-[13px] text-text appearance-none"
                  data-testid="agent-picker"
                >
                  <option value="agent">Agent</option>
                  <option value="plan">Plan</option>
                  <option value="ask">Ask</option>
                  <option value="mission">Mission</option>
                </select>
                <ChevronDown className="w-[11px] h-[11px] text-text-tertiary absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </>
          )}
          <button
            type="button"
            ref={modelButtonRef}
            onClick={onOpenModelPicker}
            className="h-[26px] text-[13px] text-text-secondary flex items-center gap-1"
            data-testid="composer-model"
          >
            <span className="w-3 h-3 rounded-full" style={{ background: '#D97757' }} aria-hidden="true" />
            {modelLabel}
            {!running && <ChevronDown className="w-[11px] h-[11px] text-text-tertiary" />}
          </button>
          {running ? (
            <button
              type="button"
              onClick={onStop}
              className="w-7 h-7 rounded-full border border-border bg-transparent text-text flex items-center justify-center"
              aria-label="Stop"
              data-testid="composer-stop"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                ready ? 'bg-accent text-white' : 'bg-tint text-text-tertiary'
              }`}
              aria-label="Send"
              data-testid="composer-send"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
