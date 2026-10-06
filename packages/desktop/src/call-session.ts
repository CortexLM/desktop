// Bot call protocol in Electron main (Task16). Tickets, the media socket, sequence/epoch/generation,
// `played` credits, resume and end live here so the bearer never reaches the renderer; the renderer
// only moves PCM (see ../../app/src/screens/work/bot-call.tsx). Same logic as the web's src/lib/bot-call.ts.
import {
  decodeLiveFrame,
  encodeLiveFrame,
  LIVE_FRAME,
  liveMediaUrl,
  parseAudioCapabilities,
} from '@cortex/api-types';

export const CALL_SAMPLE_RATE = 16_000;
const REVOKE_GRACE_MS = 2_000;
export const CALL_FRAME_SAMPLES = LIVE_FRAME.audio_bytes / 2;

export type CallPhase = 'connecting' | 'listening' | 'hearing' | 'thinking' | 'speaking' | 'reconnecting' | 'ended' | 'error';
export type CallEnd = 'ended' | 'auth_revoked' | 'superseded' | 'unavailable' | 'busy' | 'failed';
export interface CallSnapshot {
  readonly phase: CallPhase;
  readonly muted: boolean;
  /** Recognised utterances, oldest first. Replies are audio only. */
  readonly heard: readonly string[];
  readonly end?: CallEnd;
}
export interface CallStats { sent: number; mutedDropped: number; received: number; staleDropped: number; acked: number; flushed: number; maxQueued: number; resumed: number; generation: number; closeCodes: number[] }

export interface CallSocket {
  send(data: string | Uint8Array): void;
  close(): void;
}
export interface CallSocketEvents {
  message(data: ArrayBuffer | string): void;
  close(code: number): void;
}
/** HTTP + socket seams: the web passes the tab client; desktop main its own identity. */
export interface CallTransport {
  post(path: string, body: unknown): Promise<{ status: number; body: unknown }>;
  del(path: string): Promise<void>;
  open(wsPath: string, on: CallSocketEvents): CallSocket;
}
export interface CallSink {
  /** A playback frame; call `session.played` once it has been heard. */
  play(pcm: Uint8Array, sequence: number, generation: number): void;
  /** Stop and discard queued playback (barge-in, resume, end). */
  flush(): void;
}

/** True only for an available `bot_call` block; `live` (Chat Live) is never consulted. */
export function botCallAvailable(body: unknown): boolean {
  return parseAudioCapabilities(body)?.bot_call.available === true;
}

/** Browser WebSocket transport opener for `ws_path` against the API origin. */
export function openWebSocket(baseUrl: string, wsPath: string, on: CallSocketEvents): CallSocket {
  const ws = new WebSocket(liveMediaUrl(baseUrl, { ws_path: wsPath }));
  ws.binaryType = 'arraybuffer';
  ws.onmessage = (e) => on.message(e.data as ArrayBuffer | string);
  ws.onclose = (e) => on.close(e.code);
  return {
    send: (d) => { if (ws.readyState === WebSocket.OPEN) ws.send(d); },
    close: () => { if (ws.readyState <= WebSocket.OPEN) ws.close(1000, 'client'); },
  };
}

interface Ticket { readonly id: string; readonly epoch: string; readonly ws_path: string }
const isTicket = (v: unknown): v is Ticket =>
  !!v && typeof v === 'object' && typeof (v as Ticket).id === 'string' && typeof (v as Ticket).ws_path === 'string' && typeof (v as Ticket).epoch === 'string';

export class CallSession {
  readonly stats: CallStats = { sent: 0, mutedDropped: 0, received: 0, staleDropped: 0, acked: 0, flushed: 0, maxQueued: 0, resumed: 0, generation: 1, closeCodes: [] };
  #snap: CallSnapshot = { phase: 'connecting', muted: false, heard: [] };
  #listeners = new Set<(s: CallSnapshot) => void>();
  #socket: CallSocket | null = null;
  #open = false;
  #call: Ticket | null = null;
  #epoch = 0n;
  #seq = 0;
  #generation = 1;
  #closed = false;
  #retries = 0;
  /** Between our `interrupt` and the server's `interrupted`: in-flight playback is stale. */
  #barging = false;
  sink: CallSink | null = null;

  constructor(private readonly transport: CallTransport, private readonly botId: string) {}

  get snapshot(): CallSnapshot { return this.#snap; }
  subscribe(fn: (s: CallSnapshot) => void): () => void { this.#listeners.add(fn); fn(this.#snap); return () => { this.#listeners.delete(fn); }; }
  #set(patch: Partial<CallSnapshot>): void { this.#snap = { ...this.#snap, ...patch }; for (const fn of this.#listeners) fn(this.#snap); }

  async start(): Promise<void> {
    const res = await this.transport.post('/v1/live/sessions', { surface: 'bot', consent: 'allow', bot_id: this.botId })
      .catch(() => ({ status: 0, body: null }));
    if (this.#closed) {
      if (isTicket(res.body)) await this.transport.del(`/v1/live/sessions/${res.body.id}`).catch(() => undefined);
      return;
    }
    if (res.status !== 201 || !isTicket(res.body)) return this.#finish(res.status === 503 ? 'unavailable' : res.status === 409 ? 'busy' : 'failed');
    this.#connect(res.body);
  }

  #connect(ticket: Ticket): void {
    this.#call = ticket;
    this.#epoch = BigInt(ticket.epoch);
    this.#seq = 0;
    this.#open = false;
    const socket = this.transport.open(ticket.ws_path, {
      message: (d) => { if (this.#socket === socket) this.#receive(d); },
      close: (code) => { this.stats.closeCodes.push(code); if (this.#socket === socket) void this.#onClose(code); },
    });
    this.#socket = socket;
  }

  async #onClose(code: number): Promise<void> {
    this.#socket = null;
    this.#open = false;
    if (this.#closed) return;
    if (code === 4001) return this.#finish('auth_revoked');
    if (code === 1000) return this.#finish('ended');
    if (code === 4000) return this.#finish('superseded');
    if (code === 1008) return this.#finish('failed');
    // Network drop: resume with a fresh ticket for the next epoch.
    if (!this.#call || this.#retries++ >= 3) return this.#finish('failed');
    this.#flush();
    this.#set({ phase: 'reconnecting' });
    const res = await this.transport.post(`/v1/live/sessions/${this.#call.id}/resume`, { epoch: this.#call.epoch })
      .catch(() => ({ status: 0, body: null }));
    if (this.#closed) return;
    if (res.status !== 200 || !isTicket(res.body)) return this.#finish(res.status === 410 ? 'ended' : 'failed');
    this.stats.resumed++;
    this.#connect(res.body);
  }

  #receive(data: ArrayBuffer | string): void {
    if (typeof data === 'string') {
      let e: Record<string, unknown>;
      try { e = JSON.parse(data) as Record<string, unknown>; } catch { return; }
      return this.#event(e);
    }
    const frame = decodeLiveFrame(new Uint8Array(data));
    if (frame.direction !== 1) return;
    if (this.#barging || frame.epoch !== this.#epoch || frame.generation !== this.#generation) { this.stats.staleDropped++; return; }
    this.stats.received++;
    this.sink?.play(frame.audio, frame.sequence, frame.generation);
  }

  #event(e: Record<string, unknown>): void {
    switch (e.type) {
      case 'ready':
        this.#open = true;
        this.#barging = false;
        this.#retries = 0;
        if (typeof e.generation === 'number') this.#generation = e.generation;
        this.#set({ phase: 'listening' });
        if (this.#snap.muted) this.#control({ op: 'mute', muted: true });
        return;
      case 'speech_started': this.#set({ phase: 'hearing' }); return;
      case 'speech_ended': this.#set({ phase: 'thinking' }); return;
      case 'transcript': if (typeof e.text === 'string' && e.text) this.#set({ heard: [...this.#snap.heard, e.text] }); return;
      case 'reply': if (e.spoken === true) this.#set({ phase: 'speaking' }); return;
      case 'interrupted':
        this.#barging = false;
        if (typeof e.generation === 'number') this.#generation = this.stats.generation = e.generation;
        this.#flush();
        this.#set({ phase: 'listening' });
        return;
      case 'playback_end': this.#set({ phase: 'listening' }); return;
    }
  }

  /** One 640-byte PCM16 frame from the microphone. */
  capture(audio: Uint8Array): void {
    if (this.#snap.muted) { this.stats.mutedDropped++; return; }
    if (!this.#open || !this.#socket) return;
    // Capture frames always carry generation 0; only playback is generation-tagged.
    this.#socket.send(encodeLiveFrame({ direction: 0, epoch: this.#epoch, sequence: this.#seq++, generation: 0, audio }));
    this.stats.sent++;
  }

  /** Called by the sink once a playback frame has been heard. */
  played(sequence: number, generation: number): void {
    if (generation !== this.#generation) return;
    this.#control({ op: 'played', generation, sequence });
    this.stats.acked++;
  }

  #flush(): void { this.sink?.flush(); }

  #control(msg: Record<string, unknown>): void {
    if (this.#open) this.#socket?.send(JSON.stringify({ ...msg, epoch: String(this.#epoch) }));
  }

  setMuted(muted: boolean): void {
    this.#set({ muted });
    this.#control({ op: 'mute', muted });
  }

  /** Barge-in: stop what is playing now and cancel the server turn. */
  interrupt(): void {
    this.#barging = this.#open;
    this.#flush();
    this.#control({ op: 'interrupt' });
  }

  /** Hang up: tell the server, then release locally. */
  async end(): Promise<void> {
    if (this.#closed) return;
    const call = this.#call;
    const wasOpen = this.#open;
    this.#control({ op: 'end' });
    this.#finish('ended');
    if (call && !wasOpen) await this.transport.del(`/v1/live/sessions/${call.id}`).catch(() => undefined);
  }

  /** Navigation, logout or unmount: release locally and end server-side. */
  close(): void { void this.end(); }

  /** Signed out or account replaced: the server ends this session's calls (4001); only release locally. */
  revoke(): void {
    const socket = this.#socket;
    this.#socket = null;
    this.#finish('auth_revoked');
    // The server closes this session's sockets itself (4001); close locally only if it has not.
    if (socket) setTimeout(() => socket.close(), REVOKE_GRACE_MS);
  }

  #finish(end: CallEnd): void {
    if (this.#closed) return;
    this.#closed = true;
    const socket = this.#socket;
    this.#socket = null;
    this.#open = false;
    socket?.close();
    this.#flush();
    this.#set({ phase: end === 'ended' ? 'ended' : 'error', end });
  }
}
