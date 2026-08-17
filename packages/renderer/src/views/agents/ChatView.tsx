/**
 * ChatView - Main chat interface with AI agent
 * Supports streaming responses, code blocks with syntax highlighting, and stop generation
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Spinner } from '../../components/ui/spinner';
import { Check, StopCircle, Send, User, Sparkles, TriangleAlert } from 'lucide-react';
import { PermissionOverlay } from '../../components/cortex/overlays/PermissionOverlay';
import type { StreamPermissionPayload, StreamToolPayload } from '@cortex-ide/shared';
import { useErrorHandler, retryWithBackoff, toErrorMessage } from '../../hooks/use-error-handler';
// Prism and DOMPurify are intentionally NOT imported here. CodeBlock loads them
// on demand the first time a fenced code block is rendered, keeping ~120KB of
// syntax-highlighting payload out of the initial bundle.
import { CodeBlock } from '../../components/code/CodeBlock';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatViewProps {
  sessionId: string;
  model: string;
  workspacePath?: string | null;
  onClose?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ sessionId, model, workspacePath, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { handleError } = useErrorHandler();
  const [permission, setPermission] = useState<StreamPermissionPayload | null>(null);
  const [toolCards, setToolCards] = useState<StreamToolPayload[]>([]);
  const [pendingDiff, setPendingDiff] = useState<StreamToolPayload | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadMessages = useCallback(async () => {
    try {
      const response = await window.cortex.db.query({
        query:
          'SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC',
        params: [sessionId],
      });

      if (response.success && response.data) {
        const rows = response.data.rows as Array<{
          id: string;
          role: string;
          content: string;
          created_at: number;
        }>;
        setMessages(
          rows.map((row) => ({
            id: row.id,
            role: row.role as 'user' | 'assistant' | 'system',
            content: row.content,
            timestamp: row.created_at,
          }))
        );
      }
    } catch (error) {
      handleError(error, {
        title: 'Could not load conversation history',
        retry: () => void loadMessages(),
      });
    }
    // loadMessages is referenced in its own retry callback; the ref indirection
    // isn't worth it, and identity only matters for the mount effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, handleError]);

  // Load session messages
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Abort any in-flight generation if the view unmounts mid-stream.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Start streaming
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsStreaming(true);
    setStreamingMessageId(assistantMessageId);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Retried with backoff: a provider that is rate-limiting or briefly
      // unavailable usually succeeds on the next attempt, and one transient
      // 429 shouldn't cost the user their message.
      await retryWithBackoff(
        () =>
          // Chunks arrive through this callback, which is scoped to the request -
          // previously a listener was registered per send and never removed, so
          // every message multiplied the handler count.
          window.cortex.ai.streamResponse(
            {
              sessionId,
              message: userMessage.content,
              workspacePath: workspacePath ?? undefined,
              mode: 'agent',
            },
            (chunk) => {
              if (chunk.type === 'chunk' && chunk.content) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + chunk.content }
                      : msg
                  )
                );
              }
              if (chunk.type === 'tool' && chunk.tool) {
                setToolCards((prev) => {
                  const index = prev.findIndex((card) => card.id === chunk.tool!.id);
                  if (index >= 0) {
                    const next = [...prev];
                    next[index] = chunk.tool!;
                    return next;
                  }
                  return [...prev, chunk.tool!];
                });
                if (
                  chunk.tool.status === 'done' &&
                  (chunk.tool.name === 'edit' || chunk.tool.name === 'write')
                ) {
                  setPendingDiff(chunk.tool);
                }
              }
              if (chunk.type === 'permission' && chunk.permission) {
                setPermission(chunk.permission);
              }
            }
          ),
        {
          maxRetries: 2,
          initialDelay: 1000,
          signal: controller.signal,
          onRetry: (attempt) => {
            // Shown in the bubble itself: a toast per attempt would be noisy,
            // and the user is already looking at this message.
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: `Retrying (attempt ${attempt} of 2)...` }
                  : msg
              )
            );
          },
        }
      );

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
    } catch (error) {
      // Cancelling via Stop is not a failure; handleStop already tidied up.
      const wasAborted = error instanceof DOMException && error.name === 'AbortError';

      if (!wasAborted) {
        const message = toErrorMessage(error);

        handleError(error, {
          title: 'AI response failed',
          retry: () => void handleSend(),
        });

        // Also recorded in the transcript, so the failure is still visible
        // after the toast auto-dismisses.
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  role: 'system' as const,
                  content: `Failed to generate a response: ${message}`,
                  isStreaming: false,
                }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      setStreamingMessageId(null);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
    // handleSend is referenced in its own retry callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isStreaming, sessionId, workspacePath, handleError]);

  // Handle stop generation
  const handleStop = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Local state is cleared first, and unconditionally: the abort above has
    // already stopped this client consuming the stream, so the UI must leave
    // its streaming state even if telling the main process fails.
    setIsStreaming(false);
    setStreamingMessageId(null);
    setMessages((prev) =>
      prev.map((msg) => (msg.id === streamingMessageId ? { ...msg, isStreaming: false } : msg))
    );

    try {
      await window.cortex.ai.stopStream(sessionId);
    } catch (error) {
      handleError(error, {
        title: 'Could not stop generation',
        // No retry: the local stream is already detached, so retrying would
        // only re-attempt server-side cleanup the user can't observe.
      });
    }
  }, [sessionId, streamingMessageId, handleError]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }, []);

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Rebuilt only when the message array changes, so typing in the textarea (or
  // toggling streaming state) no longer re-creates every bubble element.
  const messageItems = useMemo(
    () =>
      messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      )),
    [messages]
  );

  return (
    <div className="flex flex-col h-full bg-page">
      {/* Header */}
      <div className="h-[52px] border-b border-border-soft flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-accent" />
          <div>
            <h2 className="text-sm font-medium text-text">Chat Session</h2>
            <p className="text-xs text-text-secondary">{model}</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Messages List */}
      <div
        className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin"
        role="log"
        aria-label="Conversation"
        data-testid="message-list"
      >
        {toolCards.length > 0 && (
          <div className="space-y-2" data-testid="tool-cards">
            {toolCards.map((card) => (
              <div
                key={card.id}
                className="rounded-[10px] border border-border-soft bg-elevated px-3 py-2 font-mono text-[12px]"
                data-testid="tool-card"
              >
                <div className="flex items-center gap-2">
                  {card.status === 'done' && <Check className="w-3.5 h-3.5 text-green" />}
                  <span>{card.title ?? card.name}</span>
                  {card.detail && <span className="text-text-secondary truncate">{card.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {pendingDiff && (
          <div
            className="rounded-[10px] border border-border-soft bg-elevated px-3 py-2 space-y-2"
            data-testid="apply-diff"
          >
            <div className="text-[13px] font-medium">Apply diff</div>
            <p className="text-[12px] text-text-secondary">
              {pendingDiff.title ?? pendingDiff.name} already wrote the workspace after approval.
            </p>
            <div className="font-mono text-[10px]">
              <span className="text-green">+{pendingDiff.additions ?? 0}</span>{' '}
              <span className="text-red">−{pendingDiff.deletions ?? 0}</span>
            </div>
            <button
              type="button"
              className="h-7 px-2 rounded-[6px] border border-border text-[12px]"
              onClick={() => setPendingDiff(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <Sparkles className="w-12 h-12 text-text-tertiary mx-auto" aria-hidden="true" />
              <p className="text-sm text-text-secondary">Start a conversation</p>
              <p className="text-xs text-text-tertiary">
                Ask about this codebase, generate code, or work through a problem.
              </p>
            </div>
          </div>
        ) : (
          messageItems
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border-soft p-4 space-y-3">
        {isStreaming && (
          <div
            className="flex items-center justify-between px-3 py-2 bg-tint rounded-sm"
            data-testid="streaming"
          >
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Spinner size="sm" />
              <span>Generating response...</span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              className="gap-2"
              aria-label="Stop generating response"
              data-testid="stop-generation"
            >
              <StopCircle className="w-4 h-4" aria-hidden="true" />
              Stop
            </Button>
          </div>
        )}

        <div className="flex items-end gap-3">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            className="flex-1 min-h-[44px] max-h-[200px] resize-none"
            disabled={isStreaming}
            data-testid="chat-input"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-[44px] w-[44px] rounded-full"
            aria-label="Send message"
            data-testid="send-message"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>

        <p className="text-xs text-text-tertiary px-1">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
      {permission && (
        <PermissionOverlay
          request={permission}
          onDecide={(decision) => {
            void window.cortex.ai.resolvePermission?.({
              sessionId,
              requestId: permission.id,
              decision,
            });
            setPermission(null);
          }}
        />
      )}
    </div>
  );
};

// Message Bubble Component
interface MessageBubbleProps {
  message: Message;
}

/** A parsed span of message content: either prose or a fenced code block. */
type ContentSegment =
  | { kind: 'text'; key: string; value: string }
  | { kind: 'code'; key: string; language: string; code: string };

const CODE_BLOCK_PATTERN = /```(\w+)?\n([\s\S]*?)```/g;

/**
 * Split message content into text and code segments.
 *
 * Pure and synchronous: no highlighting happens here, so it stays cheap enough
 * to run inside a useMemo on every content change during streaming.
 */
export function parseMessageContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  // Fresh regex per call: a shared /g regex carries lastIndex between calls.
  const pattern = new RegExp(CODE_BLOCK_PATTERN.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        kind: 'text',
        key: `text-${lastIndex}`,
        value: content.slice(lastIndex, match.index),
      });
    }

    segments.push({
      kind: 'code',
      key: `code-${match.index}`,
      language: match[1] || 'text',
      code: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({
      kind: 'text',
      key: `text-${lastIndex}`,
      value: content.slice(lastIndex),
    });
  }

  return segments;
}

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  // System messages are how failures are recorded in the transcript, so they
  // get error styling rather than looking like a normal reply.
  const isSystem = message.role === 'system';

  // Re-parsed only when the text actually changes, not on every parent render.
  const segments = useMemo(
    () => parseMessageContent(message.content),
    [message.content]
  );

  const renderContent = () => {
    if (segments.length === 0) {
      return <p className="whitespace-pre-wrap">{message.content}</p>;
    }

    return segments.map((segment) =>
      segment.kind === 'text' ? (
        <p key={segment.key} className="whitespace-pre-wrap">
          {segment.value}
        </p>
      ) : (
        <CodeBlock
          key={segment.key}
          code={segment.code}
          language={segment.language}
        />
      )
    );
  };

  return (
    <div
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
      role={isSystem ? 'alert' : undefined}
      data-testid={isUser ? 'user-message' : 'assistant-message'}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser && 'bg-accent text-white',
          isSystem && 'bg-red-soft text-red',
          !isUser && !isSystem && 'bg-tint text-text'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" aria-hidden="true" />
        ) : isSystem ? (
          <TriangleAlert className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Sparkles className="w-4 h-4" aria-hidden="true" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex-1 max-w-[80%] rounded-lg px-4 py-3',
          isUser && 'bg-tint',
          isSystem && 'bg-red-soft border border-red/30',
          !isUser && !isSystem && 'bg-elevated border border-border'
        )}
      >
        <div className="text-sm text-text space-y-2">
          {renderContent()}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-accent animate-pulse" />
          )}
        </div>
        <p className="text-xs text-text-tertiary mt-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
};

/**
 * Memoized message bubble.
 *
 * During streaming, setMessages replaces the whole array on every chunk, so
 * every bubble receives a new props object and React would re-render all of
 * them. Comparing the fields we actually render means only the message whose
 * content changed does work; the rest bail out.
 */
const MessageBubble = React.memo(MessageBubbleComponent, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.isStreaming === next.message.isStreaming &&
    prev.message.role === next.message.role &&
    prev.message.timestamp === next.message.timestamp
  );
});

MessageBubble.displayName = 'MessageBubble';
