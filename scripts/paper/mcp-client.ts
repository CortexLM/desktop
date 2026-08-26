/**
 * Minimal MCP client for the Paper design tool, speaking Streamable HTTP directly.
 *
 * The Paper desktop app exposes its MCP server over a tunnel. We talk to it over raw
 * JSON-RPC rather than through an SDK because the design pipeline has to run in CI and
 * in cloud agents, where no MCP host is present to broker the connection.
 *
 * Configure with:
 *   PAPER_MCP_URL   full /mcp endpoint
 *   PAPER_MCP_AUTH  value for the Authorization header
 */

const PROTOCOL_VERSION = '2024-11-05';

export interface PaperClientOptions {
  url?: string;
  auth?: string;
  fileId?: string;
  timeoutMs?: number;
}

export interface PaperTextContent {
  type: 'text';
  text: string;
}

export interface PaperImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export type PaperContent = PaperTextContent | PaperImageContent | { type: string; [k: string]: unknown };

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id?: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export class PaperError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'PaperError';
  }
}

/**
 * Streamable HTTP responses arrive as `text/event-stream` even for unary calls, so a
 * single JSON-RPC reply is one or more `data:` lines that must be reassembled.
 */
function parseStreamableBody<T>(body: string): JsonRpcResponse<T> {
  const trimmed = body.trim();
  if (!trimmed) throw new PaperError('Paper returned an empty response body');

  if (!trimmed.includes('data:')) {
    return JSON.parse(trimmed) as JsonRpcResponse<T>;
  }

  const payloads = trimmed
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .filter(Boolean);

  if (payloads.length === 0) throw new PaperError('Paper event stream carried no data frames');
  return JSON.parse(payloads.join('')) as JsonRpcResponse<T>;
}

export class PaperClient {
  private readonly url: string;
  private readonly auth: string;
  private readonly timeoutMs: number;
  private sessionId: string | null = null;
  private nextId = 1;

  readonly fileId?: string;

  constructor(options: PaperClientOptions = {}) {
    const url = options.url ?? process.env.PAPER_MCP_URL;
    const auth = options.auth ?? process.env.PAPER_MCP_AUTH;

    if (!url) {
      throw new PaperError(
        'PAPER_MCP_URL is not set. Point it at the Paper desktop MCP endpoint (…/mcp).',
      );
    }
    if (!auth) {
      throw new PaperError(
        'PAPER_MCP_AUTH is not set. Provide the Authorization header value for the Paper MCP endpoint.',
      );
    }

    this.url = url;
    this.auth = auth;
    this.fileId = options.fileId ?? process.env.PAPER_FILE_ID;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: this.auth,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
    return headers;
  }

  private async post<T>(payload: unknown, captureSession = false): Promise<JsonRpcResponse<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (captureSession) {
        this.sessionId = response.headers.get('mcp-session-id') ?? this.sessionId;
      }

      if (!response.ok) {
        throw new PaperError(
          `Paper MCP responded ${response.status} ${response.statusText}`,
          await response.text().catch(() => undefined),
        );
      }

      const text = await response.text();
      // Notifications legitimately have no body.
      if (!text.trim()) return { jsonrpc: '2.0' };
      return parseStreamableBody<T>(text);
    } finally {
      clearTimeout(timer);
    }
  }

  async connect(): Promise<void> {
    if (this.sessionId) return;

    const initialize = await this.post<unknown>(
      {
        jsonrpc: '2.0',
        id: this.nextId++,
        method: 'initialize',
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'cortex-code-paper-sync', version: '1.0.0' },
        },
      },
      true,
    );

    if (initialize.error) {
      throw new PaperError(`Paper MCP initialize failed: ${initialize.error.message}`, initialize.error);
    }
    if (!this.sessionId) {
      throw new PaperError('Paper MCP did not return an mcp-session-id header');
    }

    await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' });
  }

  /** Invoke a Paper tool and return its raw content blocks. */
  async call(tool: string, args: Record<string, unknown> = {}): Promise<PaperContent[]> {
    await this.connect();

    const params: Record<string, unknown> = { ...args };
    if (this.fileId && !('fileId' in params)) params.fileId = this.fileId;

    const response = await this.post<{ content: PaperContent[]; isError?: boolean }>({
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'tools/call',
      params: { name: tool, arguments: params },
    });

    if (response.error) {
      throw new PaperError(`Paper tool "${tool}" failed: ${response.error.message}`, response.error);
    }

    const result = response.result;
    if (!result) throw new PaperError(`Paper tool "${tool}" returned no result`);
    if (result.isError) {
      throw new PaperError(`Paper tool "${tool}" reported an error`, result.content);
    }
    return result.content ?? [];
  }

  /** Invoke a tool whose payload is a single JSON document in a text block. */
  async callJson<T>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
    const content = await this.call(tool, args);
    const text = content
      .filter((block): block is PaperTextContent => block.type === 'text')
      .map((block) => block.text)
      .join('');

    if (!text) throw new PaperError(`Paper tool "${tool}" returned no text content`);

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new PaperError(`Paper tool "${tool}" returned text that is not JSON`, text.slice(0, 500));
    }
  }

  /** Invoke a tool that renders an image and return the decoded bytes. */
  async callImage(tool: string, args: Record<string, unknown> = {}): Promise<{ bytes: Buffer; mimeType: string }> {
    const content = await this.call(tool, args);
    const image = content.find((block): block is PaperImageContent => block.type === 'image');
    if (!image) throw new PaperError(`Paper tool "${tool}" returned no image content`);
    return { bytes: Buffer.from(image.data, 'base64'), mimeType: image.mimeType };
  }
}
