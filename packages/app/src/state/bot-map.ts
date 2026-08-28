/**
 * Map API mascot/message/computer rows onto the renderer models.
 * Permissive: extra keys are ignored. Missing farm fields become honest defaults.
 */

import type { ApiBotMessage, ApiComputer, ApiMascot, ApiMascotVideo } from '@cortex-ide/cortex-api';

export type MascotShape = 'round' | 'square' | 'tall' | 'wide';
export type MascotColor = 'green' | 'terracotta' | 'ink';
export type ComputerStatus =
  | 'empty'
  | 'hibernated'
  | 'waking'
  | 'running'
  | 'stopped'
  | 'offline'
  | 'wake-failed';

export type BotMessageKind =
  | 'user'
  | 'send_to_user'
  | 'ask_user'
  | 'secret'
  | 'work';

export interface BotAttachment {
  id?: string;
  kind?: string;
  url?: string;
  name?: string;
}

export interface BotAsk {
  id?: string;
  prompt: string;
  options?: string[];
  pending: boolean;
}

export interface BotSecretAsk {
  id?: string;
  name: string;
  reason?: string;
  pending: boolean;
}

export interface BotWork {
  tool?: string;
  input?: unknown;
  output?: unknown;
}

export interface BotMessage {
  id: string;
  seq: number;
  role: 'user' | 'assistant' | 'system';
  kind: BotMessageKind;
  content: string;
  at: number;
  attachments?: BotAttachment[];
  ask?: BotAsk;
  secret?: BotSecretAsk;
  work?: BotWork;
}

export interface BotVideo {
  id: string;
  title: string;
  recordedAt: number;
  kind: string;
}

export interface BotComputer {
  id: string;
  mascotId: string;
  status: ComputerStatus;
  provider?: string;
  spec: { arch: string; vcpu: number; memoryGiB: number; browser: true };
  lastError?: string;
  screenshotUrl?: string;
}

export interface Mascot {
  id: string;
  name: string;
  shape: MascotShape;
  color: MascotColor;
  createdAt: number;
  computer: BotComputer;
  messages: BotMessage[];
  videos: BotVideo[];
}

const SHAPES: readonly MascotShape[] = ['round', 'square', 'tall', 'wide'];
const COLOURS: readonly MascotColor[] = ['green', 'terracotta', 'ink'];

export function mapMascot(row: ApiMascot): Mascot {
  const computer = mapComputer(row);
  return {
    id: row.id,
    name: row.name?.trim() || 'Untitled mascot',
    shape: asShape(row.shape),
    color: asColor(row.color),
    createdAt: Date.parse(row.created_at ?? '') || 0,
    computer,
    messages: [],
    videos: [],
  };
}

export function mapComputer(row: ApiMascot, fallback?: ApiComputer): BotComputer {
  const box = fallback ?? row.computer;
  const mapped: BotComputer = {
    id: computerId(row, box),
    mascotId: box?.mascot_id ?? row.id,
    status: asStatus(box),
    spec: computerSpec(box),
  };
  if (box?.provider) mapped.provider = box.provider;
  if (box?.last_error) mapped.lastError = box.last_error;
  if (box?.screenshot_url) mapped.screenshotUrl = box.screenshot_url;
  return mapped;
}

function computerId(row: ApiMascot, box?: ApiComputer): string {
  return box?.id ?? row.computer_id ?? `pc_${row.id}`;
}

function computerSpec(box?: ApiComputer): BotComputer['spec'] {
  return {
    arch: box?.arch ?? 'x86_64',
    vcpu: box?.vcpu ?? 4,
    memoryGiB: box?.memory_gib ?? 16,
    browser: true,
  };
}

export function mapMessage(row: ApiBotMessage, index: number): BotMessage {
  const kind = messageKind(row);
  return {
    id: row.id ?? `msg_${index}`,
    seq: row.seq ?? index,
    role: row.role === 'user' || row.role === 'system' ? row.role : 'assistant',
    kind,
    content: row.text ?? row.content ?? '',
    at: Date.parse(row.created_at ?? '') || 0,
    attachments: row.attachments,
    ask: mapAsk(row),
    secret: mapSecret(row),
    work: mapWork(row, kind),
  };
}

export function mapVideo(row: ApiMascotVideo): BotVideo {
  return {
    id: row.id,
    title: row.title ?? 'Recording',
    recordedAt: Date.parse(row.created_at ?? '') || 0,
    kind: row.kind ?? 'cursor-zoom',
  };
}

export function isPendingAsk(message: BotMessage): boolean {
  return message.kind === 'ask_user' && (message.ask?.pending ?? true);
}

export function isPendingSecret(message: BotMessage): boolean {
  return message.kind === 'secret' && (message.secret?.pending ?? true);
}

export function computerIsOffline(computer: BotComputer): boolean {
  if (computer.status === 'offline' || computer.status === 'wake-failed') return true;
  return computer.provider === 'mock';
}

function asShape(value?: string): MascotShape {
  return SHAPES.includes(value as MascotShape) ? (value as MascotShape) : 'round';
}

function asColor(value?: string): MascotColor {
  return COLOURS.includes(value as MascotColor) ? (value as MascotColor) : 'green';
}

const STATUS_MAP: Record<string, ComputerStatus> = {
  hibernated: 'hibernated',
  waking: 'waking',
  running: 'running',
  stopped: 'stopped',
  empty: 'empty',
  offline: 'offline',
  'wake-failed': 'wake-failed',
  wake_failed: 'wake-failed',
  connecting: 'waking',
};

function asStatus(box?: ApiComputer): ComputerStatus {
  if (box?.offline || box?.provider === 'mock') return 'offline';
  return STATUS_MAP[box?.status ?? ''] ?? 'hibernated';
}

const KIND_MAP: Record<string, BotMessageKind> = {
  ask_user: 'ask_user',
  'ask-user': 'ask_user',
  secret: 'secret',
  secret_request: 'secret',
  tool_call: 'work',
  tool_result: 'work',
  work: 'work',
  send_to_user: 'send_to_user',
  'send-to-user': 'send_to_user',
};

function messageKind(row: ApiBotMessage): BotMessageKind {
  const mapped = KIND_MAP[row.kind ?? ''];
  if (mapped) return mapped;
  if (row.ask_user) return 'ask_user';
  if (row.secret) return 'secret';
  if (row.tool) return 'work';
  return row.role === 'user' ? 'user' : 'send_to_user';
}

function mapAsk(row: ApiBotMessage): BotAsk | undefined {
  const ask = row.ask_user;
  if (!ask && row.kind !== 'ask_user') return undefined;
  return askFrom(ask, row.text ?? row.content ?? '');
}

function askFrom(ask: ApiBotMessage['ask_user'], fallback: string): BotAsk {
  return {
    id: ask?.id,
    prompt: ask?.prompt ?? fallback,
    options: ask?.options,
    pending: ask?.pending ?? true,
  };
}

function mapSecret(row: ApiBotMessage): BotSecretAsk | undefined {
  const secret = row.secret;
  if (!secret) return undefined;
  return {
    id: secret.id,
    name: secret.name ?? 'secret',
    reason: secret.reason,
    pending: secret.pending ?? true,
  };
}

function mapWork(row: ApiBotMessage, kind: BotMessageKind): BotWork | undefined {
  if (kind !== 'work') return undefined;
  return { tool: row.tool, input: row.tool_input, output: row.tool_output };
}
