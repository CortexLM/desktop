import { CheckpointStore } from './checkpoints';
import { composeSystemPrompt } from './system-prompt';
import { runAgentTurn } from './loop';
import { InMemoryPermissionGate } from './permissions';
import { CODING_TOOLS, toolsForMode } from './tools';
import type {
  AgentEvent,
  AgentMessage,
  AgentMode,
  AgentSessionRecord,
  ChatFn,
  FileSnapshot,
  PermissionDecision,
  PermissionRule,
  QuestionGate,
  SkillDefinition,
  TodoItem,
  ToolDefinition,
  ToolExecutor,
} from './types';

export interface AgentServerPersistence {
  save?(session: AgentSessionRecord): Promise<void> | void;
  saveMessage?(sessionId: string, role: AgentMessage['role'], content: string): Promise<void> | void;
}

export interface AgentTurnContext {
  chat: ChatFn;
  executor: ToolExecutor;
  extraTools?: ToolDefinition[];
  conventions?: string;
  skills?: SkillDefinition[];
  rules?: PermissionRule[];
}

/**
 * In-process agent server: one engine, many clients.
 * Desktop IPC, a future CLI, and tests all go through this session API
 * instead of calling provider.chat from a view.
 */
export class AgentServer {
  private sessions = new Map<string, AgentSessionRecord>();
  private gates = new Map<string, InMemoryPermissionGate>();
  private questions = new Map<string, (answer: string) => void>();
  readonly checkpoints = new CheckpointStore();
  private persist?: AgentServerPersistence;

  constructor(options?: { persist?: AgentServerPersistence }) {
    this.persist = options?.persist;
  }

  createSession(input: {
    id?: string;
    providerId: string;
    model?: string;
    workspacePath?: string;
    parentId?: string;
    title?: string;
    mode?: AgentMode;
    agentName?: string;
  }): AgentSessionRecord {
    const session: AgentSessionRecord = {
      id: input.id ?? `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      parentId: input.parentId,
      title: input.title ?? 'New session',
      providerId: input.providerId,
      model: input.model,
      workspacePath: input.workspacePath,
      mode: input.mode ?? 'agent',
      agentName: input.agentName,
      messages: [],
      todos: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.set(session.id, session);
    void this.persist?.save?.(session);
    return session;
  }

  getSession(id: string): AgentSessionRecord | undefined {
    return this.sessions.get(id);
  }

  listSessions(): AgentSessionRecord[] {
    return [...this.sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  forkSession(id: string): AgentSessionRecord {
    const source = this.require(id);
    const fork = this.createSession({
      providerId: source.providerId,
      model: source.model,
      workspacePath: source.workspacePath,
      parentId: source.id,
      title: `${source.title} (fork)`,
      mode: source.mode,
      agentName: source.agentName,
    });
    fork.messages = source.messages.map((message) => ({ ...message }));
    fork.todos = source.todos.map((todo) => ({ ...todo }));
    void this.persist?.save?.(fork);
    return fork;
  }

  createChildSession(parentId: string, title: string): AgentSessionRecord {
    const parent = this.require(parentId);
    return this.createSession({
      providerId: parent.providerId,
      model: parent.model,
      workspacePath: parent.workspacePath,
      parentId,
      title,
      mode: parent.mode,
      agentName: parent.agentName,
    });
  }

  switchModel(id: string, providerId: string, model?: string): AgentSessionRecord {
    const session = this.require(id);
    session.providerId = providerId;
    session.model = model;
    session.updatedAt = Date.now();
    void this.persist?.save?.(session);
    return session;
  }

  setMode(id: string, mode: AgentMode): void {
    const session = this.require(id);
    session.mode = mode;
    session.updatedAt = Date.now();
  }

  compactSession(id: string, keepLast = 8): AgentSessionRecord {
    const session = this.require(id);
    if (session.messages.length <= keepLast + 1) return session;
    const system = session.messages.filter((message) => message.role === 'system');
    const rest = session.messages.filter((message) => message.role !== 'system');
    const dropped = rest.slice(0, Math.max(0, rest.length - keepLast));
    const kept = rest.slice(-keepLast);
    const summary: AgentMessage = {
      role: 'system',
      content: `Compacted ${dropped.length} earlier messages. Last dropped: ${dropped.at(-1)?.content.slice(0, 240) ?? ''}`,
    };
    session.messages = [...system, summary, ...kept];
    session.updatedAt = Date.now();
    void this.persist?.save?.(session);
    return session;
  }

  revertLastTurn(id: string): AgentSessionRecord {
    const session = this.require(id);
    while (session.messages.length > 0) {
      const last = session.messages.pop();
      if (last?.role === 'user') break;
    }
    session.updatedAt = Date.now();
    void this.persist?.save?.(session);
    return session;
  }

  restoreCheckpoint(id: string, checkpointId: string): AgentMessage[] {
    const session = this.require(id);
    const messages = this.checkpoints.restore(checkpointId);
    session.messages = messages;
    session.updatedAt = Date.now();
    void this.persist?.save?.(session);
    return messages;
  }

  resolvePermission(sessionId: string, requestId: string, decision: PermissionDecision): void {
    this.gates.get(sessionId)?.resolve(requestId, decision);
  }

  resolveQuestion(sessionId: string, questionId: string, answer: string): void {
    const waiter = this.questions.get(`${sessionId}:${questionId}`);
    if (!waiter) return;
    this.questions.delete(`${sessionId}:${questionId}`);
    waiter(answer);
  }

  mergeTodos(sessionId: string, incoming: TodoItem[], merge: boolean): TodoItem[] {
    const session = this.require(sessionId);
    if (!merge) {
      session.todos = incoming;
    } else {
      const byId = new Map(session.todos.map((todo) => [todo.id, todo]));
      for (const todo of incoming) byId.set(todo.id, todo);
      session.todos = [...byId.values()];
    }
    return session.todos;
  }

  async *runTurn(sessionId: string, userText: string, context: AgentTurnContext): AsyncGenerator<AgentEvent> {
    const session = this.require(sessionId);
    const last = session.messages.at(-1);
    if (!(last?.role === 'user' && last.content === userText)) {
      session.messages.push({ role: 'user', content: userText });
    }
    session.title = session.title === 'New session' ? userText.slice(0, 42) : session.title;
    session.updatedAt = Date.now();
    void this.persist?.saveMessage?.(session.id, 'user', userText);

    const tools = toolsForMode(session.mode, [...CODING_TOOLS, ...(context.extraTools ?? [])]);
    const snapshots: FileSnapshot[] = [];
    this.checkpoints.create(session.messages, 'before turn', snapshots);

    const gate = new InMemoryPermissionGate({
      autoAllowSafe: true,
      agentName: session.agentName,
      rules: context.rules,
      onRequest: () => undefined,
    });
    this.gates.set(session.id, gate);

    const questions: QuestionGate = {
      ask: (id, _prompt, _options) =>
        new Promise((resolve) => {
          this.questions.set(`${session.id}:${id}`, resolve);
        }),
    };

    const systemPrompt = composeSystemPrompt({
      mode: session.mode,
      workspaceRoot: session.workspacePath,
      projectConventions: context.conventions,
      skills: context.skills,
      tools,
      droid: session.agentName
        ? { name: session.agentName, description: '', systemPrompt: `You are the ${session.agentName} agent.` }
        : undefined,
    });

    const visible: string[] = [];
    try {
      for await (const event of runAgentTurn({
        messages: session.messages,
        chat: context.chat,
        tools,
        executor: context.executor,
        permissions: gate,
        questions,
        systemPrompt,
        mode: session.mode,
        agentName: session.agentName,
        onMessages: (transcript) => {
          session.messages = transcript.filter(
            (message, index) => !(index === 0 && message.role === 'system')
          );
        },
      })) {
        if (event.type === 'text') visible.push(event.text);
        yield event;
      }
      session.updatedAt = Date.now();
      void this.persist?.save?.(session);
      const assistant = visible.join('\n') || '(agent turn)';
      void this.persist?.saveMessage?.(session.id, 'assistant', assistant);
    } catch (error) {
      session.messages.pop();
      yield { type: 'error', message: error instanceof Error ? error.message : String(error) };
    }
  }

  private require(id: string): AgentSessionRecord {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session "${id}" not found`);
    return session;
  }
}
