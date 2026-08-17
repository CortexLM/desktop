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
      className="rounded-[10px] border border-border bg-elevated px-3 py-2 flex flex-col gap-2"
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
          <button type="button" aria-label="Expand" className="p-1" onClick={onOpenPalette}>
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="agent-mode">
            Agent mode
          </label>
          <select
            id="agent-mode"
            value={mode}
            onChange={(event) => onModeChange(event.target.value as typeof mode)}
            className="h-7 px-2 rounded-full border border-border bg-page text-[12px]"
            data-testid="agent-picker"
          >
            <option value="agent">Agent</option>
            <option value="plan">Plan</option>
            <option value="mission">Mission</option>
            <option value="ask">Ask</option>
          </select>
          <span className="h-7 px-2 rounded-full border border-border bg-page text-[12px] flex items-center gap-1">
            {modelLabel}
            <ChevronDown className="w-2.5 h-2.5" />
          </span>
          {running ? (
            <button
              type="button"
              onClick={onStop}
              className="w-7 h-7 rounded-md border border-border flex items-center justify-center"
              aria-label="Stop"
              data-testid="composer-stop"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              className="w-7 h-7 rounded-full bg-accent text-page flex items-center justify-center"
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
