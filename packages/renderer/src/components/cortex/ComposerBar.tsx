import * as React from 'react';
import { ArrowUp, ChevronDown, Maximize2, Plus, Square } from 'lucide-react';

export function ComposerBar({
  running,
  mode,
  modelLabel,
  onModeChange,
  onSubmit,
  onStop,
  onOpenPalette,
}: {
  running: boolean;
  mode: 'agent' | 'plan' | 'mission' | 'ask';
  modelLabel: string;
  onModeChange: (mode: 'agent' | 'plan' | 'mission' | 'ask') => void;
  onSubmit: (text: string) => void;
  onStop: () => void;
  onOpenPalette?: () => void;
}) {
  const [value, setValue] = React.useState('');
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
          <button type="button" aria-label="Attach" className="p-1">
            <Plus className="w-4 h-4" />
          </button>
          {!running && (
            <button type="button" aria-label="Expand" className="p-1" onClick={onOpenPalette}>
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!running && (
            <>
              <label className="sr-only" htmlFor="agent-mode">
                Agent mode
              </label>
              <select
                id="agent-mode"
                value={mode}
                onChange={(event) => onModeChange(event.target.value as typeof mode)}
                className="h-[26px] px-2 rounded-[6px] border border-border-soft bg-wash text-[13px] text-text appearance-none pr-6"
                data-testid="agent-picker"
              >
                <option value="agent">Agent</option>
                <option value="plan">Plan</option>
                <option value="mission">Mission</option>
                <option value="ask">Ask</option>
              </select>
            </>
          )}
          <span className="h-[26px] text-[13px] text-text-secondary flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: '#D97757' }} aria-hidden="true" />
            {modelLabel}
            <ChevronDown className="w-[11px] h-[11px] text-text-tertiary" />
          </span>
          {running ? (
            <button
              type="button"
              onClick={onStop}
              className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              aria-label="Stop"
              data-testid="composer-stop"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              className="w-7 h-7 rounded-full bg-tint text-text-tertiary flex items-center justify-center"
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
