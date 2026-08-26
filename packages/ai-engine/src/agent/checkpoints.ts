import type { AgentMessage, Checkpoint, FileSnapshot } from './types';

export class CheckpointStore {
  private items = new Map<string, Checkpoint>();

  create(messages: AgentMessage[], label: string, files?: FileSnapshot[]): Checkpoint {
    const checkpoint: Checkpoint = {
      id: `ckpt-${Date.now()}-${this.items.size + 1}`,
      createdAt: Date.now(),
      label,
      messages: messages.map((message) => ({ ...message })),
      files: files?.map((file) => ({ ...file })),
    };
    this.items.set(checkpoint.id, checkpoint);
    return checkpoint;
  }

  get(id: string): Checkpoint | undefined {
    return this.items.get(id);
  }

  list(): Checkpoint[] {
    return [...this.items.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  restore(id: string): AgentMessage[] {
    const checkpoint = this.items.get(id);
    if (!checkpoint) {
      throw new Error(`Unknown checkpoint ${id}`);
    }
    return checkpoint.messages.map((message) => ({ ...message }));
  }

  restoreFiles(id: string): FileSnapshot[] {
    return (this.get(id)?.files ?? []).map((file) => ({ ...file }));
  }
}
