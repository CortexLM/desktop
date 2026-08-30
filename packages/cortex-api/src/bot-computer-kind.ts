/**
 * Where a mascot's dedicated computer runs.
 *
 * Same three kinds as Code runtimes. The labels are product language: This PC,
 * SSH, Cloud. The client never invents a kind the service did not send, and it
 * never caps the Bot tool loop while talking to that computer.
 */

import type { RuntimeKind } from './capabilities.ts';

export type ComputerKind = RuntimeKind;

const KIND_ALIASES: Record<string, ComputerKind> = {
  local: 'local',
  desktop: 'local',
  'this-pc': 'local',
  this_pc: 'local',
  ssh: 'ssh',
  cloud: 'cloud',
  farm: 'cloud',
};

export const COMPUTER_KIND_LABEL: Record<ComputerKind, string> = {
  local: 'This PC',
  ssh: 'SSH',
  cloud: 'Cloud',
};

/** Map a service field onto a kind, or undefined when nothing honest can be said. */
export function parseComputerKind(value: unknown): ComputerKind | undefined {
  if (typeof value !== 'string') return undefined;
  return KIND_ALIASES[value.trim().toLowerCase()];
}

export function computerKindLabel(kind: ComputerKind | undefined): string | undefined {
  return kind ? COMPUTER_KIND_LABEL[kind] : undefined;
}
