/**
 * Map API mascot/message/computer rows onto the renderer models.
 * Permissive: extra keys are ignored. Missing farm fields become honest defaults.
 */

import type { ApiBotMessage, ApiComputer, ApiMascot, ApiMascotVideo } from '@cortex-ide/cortex-api';

export type MascotLook = 'meadow' | 'teal' | 'terracotta' | 'amber' | 'plum' | 'slate';
export type MascotFace = 'idle' | 'slit' | 'wink';
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
  /** Absent until the service describes the machine. Never guessed. */
  spec?: { arch: string; vcpu: number; memoryGiB: number; browser: true };
  lastError?: string;
    screenshotUrl?: string;
  streamUrl?: string;
  controlHolder?: 'user' | 'bot' | 'none';
  runtime?: ComputerRuntime;
}

export type ComputerRuntime = 'this_pc' | 'ssh' | 'cloud';

export interface Mascot {
  id: string;
  name: string;
  look: MascotLook;
  face: MascotFace;
  unread: boolean;
  createdAt: number;
  computer: BotComputer;
  messages: BotMessage[];
  videos: BotVideo[];
}

const LOOKS: readonly MascotLook[] = ['meadow', 'teal', 'terracotta', 'amber', 'plum', 'slate'];
const FACES: readonly MascotFace[] = ['idle', 'slit', 'wink'];
const LEGACY_LOOK: Record<string, MascotLook> = { green: 'meadow', ink: 'slate' };
const LEGACY_FACE: Record<string, MascotFace> = { open: 'idle', narrow: 'slit', rest: 'idle' };

export function mapMascot(row: ApiMascot): Mascot {
  const computer = mapComputer(row);
  return {
    id: row.id,
    name: row.name?.trim() || 'Untitled mascot',
    look: asLook(row.look ?? row.color),
    face: asFace(row.face ?? row.resting_face ?? row.shape),
    unread: asUnread(row),
    createdAt: Date.parse(row.created_at ?? '') || 0,
    computer,
    messages: [],
    videos: [],
  };
}

/**
 * Maps the machine a mascot owns, or records that there is not one yet.
 *
 * A row the service returned without any computer field, and without even a
 * `computer_id` to point at one, gets `empty` and no spec. It used to get
 * `hibernated` and a 4 vCPU / 16 GiB x86_64 box, all four values invented here
 * — so a mascot with nothing provisioned rendered a machine that could be woken
 * and a header quoting hardware nobody had allocated.
 */
export function mapComputer(row: ApiMascot, fallback?: ApiComputer): BotComputer {
  const box = fallback ?? row.computer;
  return {
    id: computerId(row, box),
    mascotId: box?.mascot_id ?? row.id,
    status: asStatus(box, row),
    ...computerDetails(box),
  };
}

function computerId(row: ApiMascot, box?: ApiComputer): string {
  return box?.id ?? row.computer_id ?? `pc_${row.id}`;
}

/** Everything that only exists once the farm has described the machine. */
function computerDetails(box?: ApiComputer): Partial<BotComputer> {
  if (!box) return {};
  const details: Partial<BotComputer> = { spec: computerSpec(box) };
  if (box.provider) details.provider = box.provider;
  if (box.last_error) details.lastError = box.last_error;
  if (box.screenshot_url) details.screenshotUrl = box.screenshot_url;
  const stream = streamFrom(box);
  if (stream) details.streamUrl = stream;
  const holder = controlFrom(box);
  if (holder) details.controlHolder = holder;
  const runtime = runtimeFrom(box);
  if (runtime) details.runtime = runtime;
  return details;
}

function streamFrom(box: ApiComputer): string | undefined {
  const raw = box as ApiComputer & { embed_url?: string };
  const value = box.stream_url ?? raw.embed_url;
  return typeof value === 'string' && value.startsWith('https:') ? value : undefined;
}

function controlFrom(box: ApiComputer): BotComputer['controlHolder'] {
  const value = box.control_holder;
  if (value === 'user' || value === 'bot' || value === 'none') return value;
  return undefined;
}

function runtimeFrom(box: ApiComputer): ComputerRuntime | undefined {
  const value = box.runtime ?? box.mode;
  if (value === 'this_pc' || value === 'desktop' || value === 'local') return 'this_pc';
  if (value === 'ssh') return 'ssh';
  if (value === 'cloud' || value === 'farm') return 'cloud';
  return undefined;
}

function computerSpec(box: ApiComputer): NonNullable<BotComputer['spec']> {
  return {
    arch: box.arch ?? 'x86_64',
    vcpu: box.vcpu ?? 4,
    memoryGiB: box.memory_gib ?? 16,
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

/** No machine has been provisioned for this mascot. Not the same as a sleeping one. */
export function computerIsMissing(computer: BotComputer): boolean {
  return computer.status === 'empty';
}

/**
 * How a computer's state reads in a list row or a header.
 *
 * A mascot computer is a cloud farm box. The label is the machine's status,
 * never a Code workspace host and never an SSH target.
 */
export function computerLabel(computer: BotComputer): string {
  if (computerIsMissing(computer)) return 'No computer yet';
  if (computer.status === 'hibernated' || computer.status === 'stopped') return 'Asleep';
  if (computer.status === 'waking') return 'Waking';
  if (computer.status === 'offline' || computer.status === 'wake-failed') return 'Offline';
  return runtimeLabel(computer.runtime);
}

export function runtimeLabel(runtime?: ComputerRuntime): string {
  if (runtime === 'this_pc') return 'This PC';
  if (runtime === 'ssh') return 'SSH';
  if (runtime === 'cloud') return 'Cloud';
  return 'Dedicated computer';
}

function asLook(value?: string): MascotLook {
  if (LOOKS.includes(value as MascotLook)) return value as MascotLook;
  return LEGACY_LOOK[value ?? ''] ?? 'meadow';
}

function asFace(value?: string): MascotFace {
  if (FACES.includes(value as MascotFace)) return value as MascotFace;
  return LEGACY_FACE[value ?? ''] ?? 'idle';
}

function asUnread(row: ApiMascot): boolean {
  if (row.unread === true || row.has_unread === true) return true;
  return (row.unread_count ?? 0) > 0;
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

function asStatus(box: ApiComputer | undefined, row: ApiMascot): ComputerStatus {
  if (box?.offline || box?.provider === 'mock') return 'offline';
  if (!box) return row.computer_id ? 'hibernated' : 'empty';
  return STATUS_MAP[box.status ?? ''] ?? 'hibernated';
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
