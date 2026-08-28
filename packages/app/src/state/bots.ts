/**
 * Bot mascots. Creating one always creates its dedicated computer.
 * Machines are never reused across mascots.
 */

import { createSignal } from 'solid-js';

import { readJson, writeJson } from './persist.ts';

export type MascotShape = 'round' | 'square' | 'tall' | 'wide';
export type MascotColor = 'green' | 'terracotta' | 'ink';
export type ComputerStatus = 'empty' | 'hibernated' | 'waking' | 'running' | 'wake-failed';

export interface BotMessage {
  seq: number;
  role: 'user' | 'assistant';
  content: string;
  at: number;
  /** The mascot is blocked on an answer. */
  askUser?: boolean;
}

export interface BotVideo {
  id: string;
  title: string;
  recordedAt: number;
  /** Cursor + click-zoom recording, never a shared grab. */
  kind: 'cursor-zoom';
}

export interface BotComputer {
  id: string;
  mascotId: string;
  status: ComputerStatus;
  /** Spec the farm must meet. Displayed, not negotiated here. */
  spec: { arch: 'x86_64'; vcpu: number; memoryGiB: number; browser: true };
  lastError?: string;
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

const STORAGE_KEY = 'cortex.bots.v1';

const [mascots, setMascots] = createSignal<Mascot[]>(readJson(STORAGE_KEY, []));

export { mascots };

function persist(next: Mascot[]): void {
  setMascots(next);
  writeJson(STORAGE_KEY, next);
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createMascot(name: string, shape: MascotShape, color: MascotColor): Mascot {
  const id = newId('bot');
  const mascot: Mascot = {
    id,
    name: name.trim() || 'Untitled mascot',
    shape,
    color,
    createdAt: Date.now(),
    computer: {
      id: newId('pc'),
      mascotId: id,
      status: 'hibernated',
      spec: { arch: 'x86_64', vcpu: 4, memoryGiB: 16, browser: true },
    },
    messages: [],
    videos: [],
  };
  persist([mascot, ...mascots()]);
  return mascot;
}

export function mascotById(id: string): Mascot | undefined {
  return mascots().find((mascot) => mascot.id === id);
}

export function setComputerStatus(mascotId: string, status: ComputerStatus, lastError?: string): void {
  persist(
    mascots().map((mascot) => {
      if (mascot.id !== mascotId) return mascot;
      return { ...mascot, computer: { ...mascot.computer, status, lastError } };
    }),
  );
}

export function appendBotMessage(mascotId: string, message: Omit<BotMessage, 'seq'>): void {
  persist(
    mascots().map((mascot) => {
      if (mascot.id !== mascotId) return mascot;
      const seq = mascot.messages.length === 0 ? 0 : mascot.messages[mascot.messages.length - 1]!.seq + 1;
      return { ...mascot, messages: [...mascot.messages, { ...message, seq }] };
    }),
  );
}
