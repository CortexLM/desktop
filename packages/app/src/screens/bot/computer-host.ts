/**
 * This PC / SSH / Cloud for a mascot computer. Locks follow Code runtimes:
 * This PC is desktop-only; Cloud and SSH need an account.
 */

import {
  canUseRuntime,
  type Capabilities,
  type ComputerKind,
  COMPUTER_KIND_LABEL,
  type AppSurface,
} from '@cortex-ide/cortex-api';

export type { ComputerKind };

export interface ComputerHostOption {
  id: ComputerKind;
  label: string;
  body: string;
  lockedReason?: string;
}

const HOST_BODY: Record<ComputerKind, string> = {
  local: 'This mascot uses this machine as its computer.',
  ssh: 'A server you already connected. Keys stay on the service, never in this app.',
  cloud: 'A dedicated Cortex farm box, asleep when idle.',
};

const HOST_ORDER: readonly ComputerKind[] = ['local', 'ssh', 'cloud'];

export function computerHostLock(
  kind: ComputerKind,
  capabilities: Capabilities,
  surface: AppSurface,
): string | undefined {
  if (kind === 'local' && (surface === 'browser' || !canUseRuntime(kind, capabilities))) {
    return 'This PC runs in the Cortex desktop app.';
  }
  if (!canUseRuntime(kind, capabilities)) {
    return 'Cloud and SSH need a Cortex account.';
  }
  return undefined;
}

export function computerHostOptions(
  capabilities: Capabilities,
  surface: AppSurface,
): ComputerHostOption[] {
  return HOST_ORDER.map((id) => {
    const lockedReason = computerHostLock(id, capabilities, surface);
    const option: ComputerHostOption = { id, label: COMPUTER_KIND_LABEL[id], body: HOST_BODY[id] };
    if (lockedReason) option.lockedReason = lockedReason;
    return option;
  });
}

export function defaultComputerKind(
  capabilities: Capabilities,
  surface: AppSurface,
): ComputerKind | undefined {
  const preferred: ComputerKind[] = surface === 'browser' ? ['cloud', 'ssh'] : ['local', 'cloud', 'ssh'];
  return preferred.find((kind) => !computerHostLock(kind, capabilities, surface));
}
