import { Brain, Check, ChevronRight, FileText, GitBranch, ListChecks, Maximize2, Plus, Square, ArrowUp } from 'lucide-react';
import { ComposerBar } from './ComposerBar';
import type { SessionAgent, TranscriptItem } from './use-session-agent';

export function SessionCenter({
  agent,
  onOpenCommandPalette,
}: {
  agent: SessionAgent;
  onOpenCommandPalette?: () => void;
}) {
  const empty = agent.transcript.length === 0 && !agent.running;

  return (
    <main
      className="flex-1 min-w-0 flex flex-col bg-page relative"
      data-testid="session-center"
      aria-label="Session"
    >
      {agent.goal && (
        <div
          className="absolute top-3 right-4 z-10 h-7 px-3 rounded-full bg-elevated border border-border-soft text-[12px] text-text-secondary max-w-[360px] truncate"
          data-testid="goal-chip"
        >
          {agent.goal}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto px-6 py-8">
        {empty ? (
          <EmptySession onPick={(text) => void agent.send(text)} />
        ) : (
          <div className="max-w-[796px] mx-auto flex flex-col gap-3" data-testid="agent-transcript">
            {agent.transcript.map((item) => (
              <TranscriptRow key={item.id} item={item} />
            ))}
            {agent.running && (
              <div className="flex items-center gap-2" data-testid="working-indicator">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-soft flex-shrink-0" />
                <span className="text-[12px] text-text-secondary">Working</span>
                <span className="font-mono text-[10px] text-text-tertiary">
                  {agent.elapsed}s · esc to interrupt
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-6 pb-4">
        <div className="max-w-[796px] mx-auto flex flex-col gap-2">
          {agent.filesChanging && (
            <div className="h-[34px] px-3 rounded-[10px] border border-border-soft bg-elevated flex items-center gap-2 text-[13px]">
              <FileText className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
              <span className="flex-1">{agent.filesChanging.replace(/\s\+.*$/, '')}</span>
              <span className="font-mono text-[12px] text-green">+</span>
              <span className="font-mono text-[12px] text-red">−</span>
              <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
            </div>
          )}
          <ComposerBar
            running={agent.running}
            mode={agent.mode}
            modelLabel={agent.modelLabel}
            onModeChange={agent.setMode}
            onSubmit={(text) => void agent.send(text)}
            onStop={() => void agent.interrupt()}
            onOpenPalette={onOpenCommandPalette}
          />
        </div>
      </div>
    </main>
  );
}

function TranscriptRow({ item }: { item: TranscriptItem }) {
  if (item.kind === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[420px] bg-elevated border border-border-soft px-3 py-2 text-[13px] text-text rounded-[12px] [border-bottom-right-radius:4px]">
          {item.text}
        </div>
      </div>
    );
  }
  if (item.kind === 'thinking') {
    return (
      <div className="flex items-start gap-2">
        <Brain className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent" />
        <span className="text-[12px]">
          <span className="font-medium text-text-secondary">Thinking</span>{' '}
          <span className="text-text-tertiary">{item.text}</span>
        </span>
      </div>
    );
  }
  if (item.kind === 'tool' && item.tool) {
    const running = item.tool.status === 'running';
    const title = [item.tool.title ?? item.tool.name, item.tool.detail].filter(Boolean).join(' ');
    const duration =
      item.tool.durationMs != null ? `${(item.tool.durationMs / 1000).toFixed(1)}s` : null;
    return (
      <div
        className="rounded-[10px] border border-border-soft bg-elevated px-[13px] py-[11px]"
        data-testid="tool-card"
        data-tool={item.tool.name}
      >
        <div className="flex items-center gap-2">
          {!running && <Check className="w-3.5 h-3.5 text-green flex-shrink-0" />}
          <div className="font-mono text-[12px] text-text min-w-0 truncate">{title}</div>
          {duration && !running && (
            <span className="ml-auto font-mono text-[10px] text-text-tertiary">{duration}</span>
          )}
        </div>
        {(item.tool.additions != null || item.tool.deletions != null) && (
          <div className="pl-5 mt-1 font-mono text-[10px]">
            <span className="text-green">+{item.tool.additions ?? 0}</span>{' '}
            <span className="text-red">−{item.tool.deletions ?? 0}</span>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="text-[13px] text-text-secondary whitespace-pre-wrap">{item.text}</div>
  );
}

function EmptySession({ onPick }: { onPick: (text: string) => void }) {
  const chips = [
    { label: 'Fix a failing test', icon: ListChecks },
    { label: 'Review my changes', icon: GitBranch },
    { label: 'Explain this codebase', icon: FileText },
  ];
  return (
    <div className="h-full flex flex-col items-center justify-center gap-[18px]" data-testid="empty-session">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" fill="#FCFCFC">
        <path d="M11 1h4v9h9v4h-9v9h-4v-9H2v-4h9V1z" />
      </svg>
      <h1 className="text-[24px] font-medium leading-[30px] tracking-tight">
        <span className="text-text-secondary">Hey,</span>{' '}
        <span className="text-text">what should we build?</span>
      </h1>
      <div className="flex items-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onPick(chip.label)}
            className="h-7 px-3 rounded-full border border-border bg-transparent text-[12px] text-text flex items-center gap-1.5"
          >
            <chip.icon className="w-[11px] h-[11px] text-text-secondary" />
            {chip.label}
          </button>
        ))}
      </div>
      <p className="font-mono text-[10px] text-text-tertiary">⌘K commands · ⌘J terminal · @ context</p>
    </div>
  );
}

export function ComposerIcons() {
  return (
    <>
      <Plus className="w-4 h-4" />
      <Maximize2 className="w-4 h-4" />
      <Square className="w-4 h-4" />
      <ArrowUp className="w-4 h-4" />
    </>
  );
}
