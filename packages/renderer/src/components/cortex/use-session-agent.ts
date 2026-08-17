import * as React from 'react';
import type { StreamChunk, StreamPermissionPayload, StreamPlanPayload, StreamToolPayload } from '@cortex-ide/shared';

export interface SessionRow {
  id: string;
  title: string;
  group: 'recent' | 'project';
}

export interface ToolCardState extends StreamToolPayload {}

export interface TranscriptItem {
  id: string;
  kind: 'user' | 'thinking' | 'text' | 'tool';
  text?: string;
  tool?: ToolCardState;
}

export function useSessionAgent(workspacePath: string | null) {
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = React.useState('New session');
  const [sessions, setSessions] = React.useState<SessionRow[]>([]);
  const [transcript, setTranscript] = React.useState<TranscriptItem[]>([]);
  const [running, setRunning] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [queued, setQueued] = React.useState<string[]>([]);
  const [goal, setGoal] = React.useState<string | null>(null);
  const [permission, setPermission] = React.useState<StreamPermissionPayload | null>(null);
  const [plan, setPlan] = React.useState<StreamPlanPayload | null>(null);
  const [contextFull, setContextFull] = React.useState(false);
  const [providerError, setProviderError] = React.useState<string | null>(null);
  const [model, setModelState] = React.useState('claude-sonnet-4');
  const [provider, setProvider] = React.useState<'openai' | 'anthropic' | 'openrouter' | 'ollama'>('anthropic');
  const [pendingModel, setPendingModel] = React.useState<{
    model: string;
    provider: 'openai' | 'anthropic' | 'openrouter' | 'ollama';
  } | null>(null);
  const [mode, setMode] = React.useState<'agent' | 'plan' | 'mission' | 'ask'>('agent');
  const [branch, setBranch] = React.useState('main');
  const [filesChanging, setFilesChanging] = React.useState<{
    files: number;
    additions: number;
    deletions: number;
  } | null>(null);
  const startedAt = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      if (startedAt.current) {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [running]);

  const loadSessions = React.useCallback(async () => {
    try {
      const response = await window.cortex.db.query<{
        id: string;
        title: string | null;
      }>({
        query: 'SELECT id, title FROM sessions ORDER BY updated_at DESC LIMIT 20',
      });
      if (response.success) {
        const rows = (response.data.rows ?? []).map((row, index) => ({
          id: row.id,
          title: row.title || 'Untitled session',
          group: index < 4 ? ('recent' as const) : ('project' as const),
        }));
        setSessions(rows);
      }
    } catch {
      // Empty list until a session exists.
    }
  }, []);

  React.useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const ensureSession = React.useCallback(async () => {
    if (sessionId) return sessionId;
    const response = await window.cortex.ai.createSession({
      provider,
      model,
    });
    if (!response?.success) {
      throw new Error(response?.error?.message ?? 'Could not create session');
    }
    const id = response.data.sessionId;
    setSessionId(id);
    setSessionTitle('New session');
    await loadSessions();
    return id;
  }, [loadSessions, model, provider, sessionId]);

  const applyChunk = React.useCallback((chunk: StreamChunk) => {
    if (chunk.type === 'thinking' && chunk.content) {
      setTranscript((prev) => [...prev, { id: `th-${prev.length}`, kind: 'thinking', text: chunk.content }]);
    }
    if (chunk.type === 'chunk' && chunk.content) {
      setTranscript((prev) => [...prev, { id: `tx-${prev.length}`, kind: 'text', text: chunk.content }]);
    }
    if (chunk.type === 'tool' && chunk.tool) {
      setTranscript((prev) => {
        const existing = prev.findIndex((item) => item.kind === 'tool' && item.tool?.id === chunk.tool?.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = { ...next[existing], tool: chunk.tool };
          return next;
        }
        return [...prev, { id: chunk.tool!.id, kind: 'tool', tool: chunk.tool }];
      });
      if (chunk.tool.additions != null || chunk.tool.deletions != null) {
        setFilesChanging({
          files: 1,
          additions: chunk.tool.additions ?? 0,
          deletions: chunk.tool.deletions ?? 0,
        });
      }
    }
    if (chunk.type === 'permission' && chunk.permission) {
      setPermission(chunk.permission);
    }
    if (chunk.type === 'plan' && chunk.plan) {
      setPlan(chunk.plan);
    }
    if (chunk.type === 'context_full') {
      setContextFull(true);
    }
    if (chunk.type === 'error') {
      setProviderError(chunk.error ?? 'Provider error');
    }
  }, []);

  const send = React.useCallback(
    async (text: string) => {
      if (running) {
        setQueued((prev) => [...prev, text]);
        return;
      }
      const id = await ensureSession();
      setTranscript((prev) => [...prev, { id: `u-${Date.now()}`, kind: 'user', text }]);
      setGoal(text);
      setSessionTitle(text.slice(0, 42) || 'New session');
      setRunning(true);
      startedAt.current = Date.now();
      setElapsed(0);
      try {
        await window.cortex.ai.streamResponse(
          {
            sessionId: id,
            message: text,
            workspacePath: workspacePath ?? undefined,
            mode,
          },
          applyChunk
        );
      } catch (error) {
        setProviderError(error instanceof Error ? error.message : String(error));
      } finally {
        setRunning(false);
        startedAt.current = null;
        setQueued((prev) => {
          const [next, ...rest] = prev;
          if (next) {
            queueMicrotask(() => {
              void send(next);
            });
          }
          return rest;
        });
      }
    },
    [applyChunk, ensureSession, mode, running, workspacePath]
  );

  const interrupt = React.useCallback(async () => {
    if (sessionId) await window.cortex.ai.stopStream(sessionId);
    setRunning(false);
  }, [sessionId]);

  const decidePermission = React.useCallback(
    async (decision: 'allow-once' | 'allow-always' | 'deny') => {
      if (!sessionId || !permission) return;
      await window.cortex.ai.resolvePermission({
        sessionId,
        requestId: permission.id,
        decision,
      });
      setPermission(null);
    },
    [permission, sessionId]
  );

  return {
    sessionId,
    sessionTitle,
    sessions,
    transcript,
    running,
    elapsed,
    queued,
    goal,
    permission,
    plan,
    contextFull,
    providerError,
    model,
    modelLabel: model.replace('claude-', 'Claude ').replace('sonnet-4', 'Sonnet 4'),
    provider,
    mode,
    branch,
    worktrees: [
      { name: `${branch}`, pr: '' },
    ],
    cpuLabel: '5.3%',
    filesChanging,
    newSession: async () => {
      setSessionId(null);
      setTranscript([]);
      setGoal(null);
      setPlan(null);
      setFilesChanging(null);
      setSessionTitle('New session');
      await ensureSession();
    },
    selectSession: (id: string) => {
      setSessionId(id);
      const found = sessions.find((row) => row.id === id);
      setSessionTitle(found?.title ?? 'Session');
    },
    send,
    interrupt,
    decidePermission,
    pendingModel,
    proposeModel: (next: string, nextProvider?: typeof provider) => {
      setPendingModel({ model: next, provider: nextProvider ?? provider });
    },
    applyPendingModel: () => {
      if (!pendingModel) return;
      setModelState(pendingModel.model);
      setProvider(pendingModel.provider);
      setPendingModel(null);
    },
    dismissPendingModel: () => setPendingModel(null),
    deleteSession: (id: string) => {
      setSessions((prev) => prev.filter((row) => row.id !== id));
      if (sessionId === id) {
        setSessionId(null);
        setTranscript([]);
        setSessionTitle('New session');
      }
    },
    cycleSession: (direction: 1 | -1) => {
      if (sessions.length === 0) return;
      const index = Math.max(0, sessions.findIndex((row) => row.id === sessionId));
      const next = sessions[(index + direction + sessions.length) % sessions.length];
      if (next) {
        setSessionId(next.id);
        setSessionTitle(next.title);
      }
    },
    setMode,
    setBranch,
    approvePlan: () => setPlan((prev) => (prev ? { ...prev, approved: true } : prev)),
    rejectPlan: () => setPlan(null),
    clearProviderError: () => setProviderError(null),
    compactContext: () => setContextFull(false),
    restoreCheckpoint: async (checkpointId: string) => {
      if (!sessionId) return;
      await window.ipc.invoke('ai:restore-checkpoint', { sessionId, checkpointId });
    },
  };
}

export type SessionAgent = ReturnType<typeof useSessionAgent>;
