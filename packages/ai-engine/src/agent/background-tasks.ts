/**
 * Background Task children. Nested Task is forbidden. Children never AskUser.
 * The parent receives started / progress / completed / failed with id + summary.
 */

import type { ArtifactHost, TaskHost, BackgroundTaskKind, TaskPayload, TaskSpawnRequest, AgentEvent } from './types';

export const DEFAULT_TASK_TIMEOUT_MS = 120_000;

export type ChildRunner = (input: {
  id: string;
  kind: BackgroundTaskKind;
  prompt: string;
  signal: AbortSignal;
  onProgress: (summary: string) => void;
}) => Promise<{ summary: string; output: string }>;

export function resolveTaskKind(args: Record<string, unknown>): BackgroundTaskKind | undefined {
  const raw = String(args.kind ?? args.subagent ?? args.droid ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'explore' || raw === 'explorer') return 'explore';
  if (raw === 'plan') return 'plan';
  if (raw === 'worker') return 'worker';
  return undefined;
}

export class BackgroundTaskRegistry implements TaskHost {
  private readonly open = new Map<string, AbortController>();
  private readonly pending: AgentEvent[] = [];
  private readonly waits = new Map<string, Promise<void>>();
  private next = 1;

  constructor(
    private readonly run: ChildRunner,
    private readonly artifacts?: ArtifactHost,
    private readonly timeoutMs = DEFAULT_TASK_TIMEOUT_MS,
  ) {}

  spawn(request: TaskSpawnRequest): TaskPayload {
    const id = `task_${this.next}`;
    this.next += 1;
    const summary = `${request.kind}: ${request.prompt.slice(0, 160)}`;
    const controller = new AbortController();
    this.open.set(id, controller);
    this.waits.set(id, this.track(id, request, controller, summary));
    return { id, summary };
  }

  cancel(id: string): void {
    this.open.get(id)?.abort();
  }

  cancelAll(): void {
    for (const controller of this.open.values()) controller.abort();
  }

  drain(): AgentEvent[] {
    return this.pending.splice(0, this.pending.length);
  }

  openIds(): string[] {
    return [...this.open.keys()];
  }

  async waitOpen(): Promise<void> {
    await Promise.allSettled([...this.waits.values()]);
  }

  private async track(
    id: string,
    request: TaskSpawnRequest,
    controller: AbortController,
    started: string,
  ): Promise<void> {
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const result = await Promise.race([
        this.run({
          id,
          kind: request.kind,
          prompt: request.prompt,
          signal: controller.signal,
          onProgress: (summary) => this.pending.push({ type: 'task_progress', id, summary }),
        }),
        abortPromise(controller.signal),
      ]);
      this.finish(id, result.summary || started, result.output, controller.signal.aborted);
    } catch (error) {
      const failed = controller.signal.aborted
        ? 'Task cancelled or timed out'
        : error instanceof Error
          ? error.message
          : String(error);
      this.pending.push({ type: 'task_failed', id, summary: failed });
    } finally {
      clearTimeout(timer);
      this.open.delete(id);
      this.waits.delete(id);
    }
  }

  private finish(id: string, summary: string, output: string, aborted: boolean): void {
    if (aborted) {
      this.pending.push({ type: 'task_failed', id, summary: 'Task cancelled or timed out' });
      return;
    }
    const stub = this.artifacts?.offload('Task', output) ?? { output };
    this.pending.push({
      type: 'task_completed',
      id,
      summary,
      artifact_id: stub.artifact_id,
    });
  }
}

function abortPromise(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = () => reject(new Error('Task cancelled or timed out'));
    if (signal.aborted) fail();
    else signal.addEventListener('abort', fail, { once: true });
  });
}

export function completionReminder(event: AgentEvent): string | undefined {
  if (event.type === 'task_completed') {
    const artifact = event.artifact_id ? ` artifact_id=${event.artifact_id}` : '';
    return `task_completed id=${event.id} summary=${event.summary}${artifact}`;
  }
  if (event.type === 'task_failed') {
    return `task_failed id=${event.id} summary=${event.summary}`;
  }
  return undefined;
}
