import { Check, Info, Maximize2, Plus, Square, ArrowUp } from 'lucide-react';
import { ChatExportButton } from '../chat/ChatExportButton';
import { ComposerBar } from './ComposerBar';
import type { SessionAgent } from './use-session-agent';

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
          className="absolute top-3 right-4 z-10 h-7 px-3 rounded-full bg-elevated border border-border text-[12px] text-text-secondary max-w-[360px] truncate"
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
            {agent.transcript.map((item) => {
              if (item.kind === 'user') {
                return (
                  <div key={item.id} className="text-[14px] text-text">
                    {item.text}
                  </div>
                );
              }
              if (item.kind === 'thinking') {
                return (
                  <div key={item.id} className="flex items-start gap-2 text-[13px] text-text-secondary">
                    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="text-text">Thinking</span> {item.text}
                    </span>
                  </div>
                );
              }
              if (item.kind === 'tool' && item.tool) {
                const running = item.tool.status === 'running';
                return (
                  <div
                    key={item.id}
                    className="rounded-[10px] border border-border bg-elevated px-3 py-2"
                    data-testid="tool-card"
                    data-tool={item.tool.name}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[13px]">
                        {item.tool.title ?? item.tool.name}{' '}
                        <span className="font-mono text-text-secondary">{item.tool.detail}</span>
                      </div>
                      {running ? (
                        <span className="text-[11px] text-text-tertiary">working</span>
                      ) : (
                        <Check className="w-3.5 h-3.5 text-green flex-shrink-0" />
                      )}
                    </div>
                    {(item.tool.additions != null || item.tool.deletions != null) && (
                      <div className="text-[12px] font-mono mt-1">
                        <span className="text-green">+{item.tool.additions ?? 0}</span>{' '}
                        <span className="text-red">-{item.tool.deletions ?? 0}</span>
                        {item.tool.durationMs != null && (
                          <span className="text-text-tertiary"> · {(item.tool.durationMs / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div key={item.id} className="text-[14px] text-text-secondary whitespace-pre-wrap">
                  {item.text}
                </div>
              );
            })}
            {agent.running && (
              <div className="text-[12px] text-text-tertiary" data-testid="working-indicator">
                Working {agent.elapsed}s · esc to interrupt
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-6 pb-4">
        <div className="max-w-[796px] mx-auto">
          {agent.filesChanging && (
            <div className="h-[34px] flex items-center justify-between text-[12px] text-text-secondary px-1">
              <span>{agent.filesChanging}</span>
              {agent.sessionId && <ChatExportButton sessionId={agent.sessionId} sessionTitle={agent.sessionTitle} />}
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

function EmptySession({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4" data-testid="empty-session">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor" className="text-text" />
        <rect x="15" y="1" width="10" height="10" rx="2" fill="currentColor" className="text-text-tertiary" />
        <rect x="1" y="15" width="10" height="10" rx="2" fill="currentColor" className="text-text-tertiary" />
        <rect x="15" y="15" width="10" height="10" rx="2" fill="currentColor" className="text-accent" />
      </svg>
      <h1 className="text-[24px] font-medium tracking-tight">Hey, what should we build?</h1>
      <div className="flex items-center gap-2">
        {['Fix a failing test', 'Review my changes', 'Explain this codebase'].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onPick(chip)}
            className="h-7 px-3 rounded-full border border-border bg-elevated text-[13px] text-text-secondary hover:text-text"
          >
            {chip}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-text-tertiary">⌘K commands · ⌘J terminal · @ context</p>
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
