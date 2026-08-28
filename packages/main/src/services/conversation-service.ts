/**
 * Conversation Service — the Chat product's threads.
 *
 * Deliberately NOT a second SessionService: a conversation is a linear exchange
 * with a provider — no repo, no tools, no permissions, no diff. It talks to the
 * default provider's `stream()` directly and persists plain messages.
 *
 * Streaming goes out as `progress` events (relayed to the renderer over
 * `EVENT_CHAT_PROGRESS`) while the reply accumulates; the full message is
 * persisted once the stream closes, so a crash mid-stream loses the tail of one
 * reply rather than corrupting the thread.
 */

import { EventEmitter } from 'node:events';

import type {
  ChatMessage,
  ChatMode,
  ChatProgressEvent,
  ConversationDetail,
  ConversationSummary,
} from '@cortex-ide/shared';
import type { Message } from '@cortex-ide/ai-engine';

import { getDatabaseService } from './database-service';
import { getAIService, type AIService } from './ai-service';

interface ConversationRow {
  id: string;
  title: string;
  mode: string;
  provider: string | null;
  model: string | null;
  archived: number;
  created_at: number;
  updated_at: number;
}

interface MessageRow {
  seq: number;
  role: string;
  content: string;
  created_at: number;
}

/** What each mode asks of the model. Both are honest: no live web access yet. */
const MODE_PROMPTS: Record<ChatMode, string> = {
  search:
    'You are Cortex. Answer directly and concisely. When a claim depends on facts you are ' +
    'not certain of, say so plainly rather than inventing a citation.',
  reason:
    'You are Cortex in extended thinking mode. Work through the problem step by step ' +
    'before answering, and show the reasoning that matters.',
};

function toSummary(row: ConversationRow): ConversationSummary {
  const summary: ConversationSummary = {
    id: row.id,
    title: row.title,
    mode: row.mode === 'reason' ? 'reason' : 'search',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.provider) summary.provider = row.provider;
  if (row.model) summary.model = row.model;
  return summary;
}

function toMessage(row: MessageRow): ChatMessage {
  return {
    seq: row.seq,
    role: row.role === 'user' ? 'user' : 'assistant',
    content: row.content,
    at: row.created_at,
  };
}

export class ConversationService extends EventEmitter {
  private readonly ai: AIService;

  /** Abort handles for replies in flight, so Stop is more than a UI state. */
  private readonly running = new Map<string, AbortController>();

  constructor(options: { ai?: AIService } = {}) {
    super();
    this.ai = options.ai ?? getAIService();
  }

  // ==========================================================================
  // Reads
  // ==========================================================================

  async list(): Promise<ConversationSummary[]> {
    const db = getDatabaseService();
    const result = await db.query<ConversationRow>(
      'SELECT * FROM conversations WHERE archived = 0 ORDER BY updated_at DESC LIMIT 100',
    );
    return result.rows.map(toSummary);
  }

  async get(id: string): Promise<ConversationDetail | null> {
    const db = getDatabaseService();
    const rows = await db.query<ConversationRow>('SELECT * FROM conversations WHERE id = ?', [id]);
    const row = rows.rows[0];
    if (!row) return null;

    const messages = await db.query<MessageRow>(
      'SELECT seq, role, content, created_at FROM conversation_messages WHERE conversation_id = ? ORDER BY seq ASC',
      [id],
    );

    return { ...toSummary(row), messages: messages.rows.map(toMessage) };
  }

  /** The composer's model label: "OpenRouter · gpt-4o-mini", or the provider name. */
  modelLabel(): string {
    const provider = this.ai.chatProvider();
    if (!provider) return 'No model configured';
    return provider.defaultModel ? `${provider.name} · ${provider.defaultModel}` : provider.name;
  }

  // ==========================================================================
  // Writes
  // ==========================================================================

  async start(prompt: string, mode: ChatMode = 'search'): Promise<ConversationDetail> {
    const now = Date.now();
    const id = `chat_${now}_${Math.random().toString(36).slice(2, 9)}`;
    // The first prompt is the only honest title available at creation time.
    const title = prompt.length > 64 ? `${prompt.slice(0, 63)}…` : prompt;

    const db = getDatabaseService();
    await db.execute([
      {
        query:
          'INSERT INTO conversations (id, title, mode, archived, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
        params: [id, title, mode, now, now],
      },
      {
        query:
          'INSERT INTO conversation_messages (conversation_id, seq, role, content, created_at) VALUES (?, 0, ?, ?, ?)',
        params: [id, 'user', prompt, now],
      },
    ]);

    void this.reply(id);

    return (await this.get(id))!;
  }

  async send(id: string, prompt: string): Promise<ConversationDetail | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    if (this.running.has(id)) return existing;

    await this.append(id, 'user', prompt);
    void this.reply(id);
    return await this.get(id);
  }

  stop(id: string): void {
    this.running.get(id)?.abort();
    this.running.delete(id);
  }

  async remove(id: string): Promise<void> {
    this.stop(id);
    const db = getDatabaseService();
    await db.execute([{ query: 'DELETE FROM conversations WHERE id = ?', params: [id] }]);
  }

  // ==========================================================================
  // The reply
  // ==========================================================================

  /**
   * Streams one assistant reply.
   *
   * Never rejects: a failed reply lands in the thread as its own message naming
   * the reason, because a conversation that silently stops looks like the app
   * hung rather than like something the user can fix.
   */
  private async reply(id: string): Promise<void> {
    const abort = new AbortController();
    this.running.set(id, abort);

    try {
      const detail = await this.get(id);
      if (!detail) return;

      const provider = this.ai.chatProvider();
      if (!provider) {
        await this.close(id, 'No model is configured. Add a provider key in Settings.', true);
        return;
      }

      const messages: Message[] = [
        { role: 'system', content: MODE_PROMPTS[detail.mode] },
        ...detail.messages.map((message) => ({ role: message.role, content: message.content })),
      ];

      let content = '';
      for await (const chunk of provider.stream(messages)) {
        if (abort.signal.aborted) break;
        if (!chunk.content) continue;
        content += chunk.content;
        this.progress({ conversationId: id, delta: chunk.content });
      }

      await this.close(id, content || '(no reply)', false);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.close(id, `The reply failed: ${reason}`, true);
    } finally {
      this.running.delete(id);
    }
  }

  /** Persists the assistant turn and announces the end of the stream. */
  private async close(id: string, content: string, failed: boolean): Promise<void> {
    await this.append(id, 'assistant', content);
    this.progress({ conversationId: id, done: true, ...(failed ? { error: content } : {}) });
  }

  private async append(id: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const db = getDatabaseService();
    const now = Date.now();
    await db.execute([
      {
        query:
          'INSERT INTO conversation_messages (conversation_id, seq, role, content, created_at) ' +
          'VALUES (?, (SELECT COALESCE(MAX(seq), -1) + 1 FROM conversation_messages WHERE conversation_id = ?), ?, ?, ?)',
        params: [id, id, role, content, now],
      },
      {
        query: 'UPDATE conversations SET updated_at = ? WHERE id = ?',
        params: [now, id],
      },
    ]);
  }

  private progress(event: ChatProgressEvent): void {
    this.emit('progress', event);
  }

  dispose(): void {
    for (const controller of this.running.values()) controller.abort();
    this.running.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: ConversationService | null = null;

export function getConversationService(): ConversationService {
  if (!instance) instance = new ConversationService();
  return instance;
}

export function resetConversationService(): void {
  instance?.dispose();
  instance = null;
}
