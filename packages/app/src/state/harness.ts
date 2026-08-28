/**
 * Code harness status. The browser never runs the harness; desktop may.
 *
 * Screens read this module instead of inventing a fourth "ready".
 */

import { createSignal } from 'solid-js';

import { chromePlatform } from './platform.ts';
import { readJson, writeJson } from './persist.ts';

export type HarnessKind =
  | 'cloud-only'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'cloud-session-running'
  | 'permission-blocked'
  | 'failed-wake';

export interface HarnessStatus {
  kind: HarnessKind;
  /** Named host when connected, e.g. "ana-mbp" or "code.internal". */
  hostLabel?: string;
  detail?: string;
}

const REMOTE_KEY = 'cortex.harness.remote-host';

const [remoteHost, setRemoteHostSignal] = createSignal(readJson<string>(REMOTE_KEY, ''));

export { remoteHost };

export function setRemoteHost(url: string): void {
  const trimmed = url.trim();
  setRemoteHostSignal(trimmed);
  writeJson(REMOTE_KEY, trimmed);
}

export function isBrowserSurface(): boolean {
  return chromePlatform() === 'browser';
}

/**
 * Derives the banner the Code product should show.
 *
 * `cloudSession` and `permissionBlocked` win over the socket: a run that is
 * alive in the cloud, or waiting on Allow/Always/Deny, is more important than
 * whether this laptop's PTY is up.
 */
export function harnessStatus(input: {
  authenticated: boolean;
  cloudSession?: boolean;
  permissionBlocked?: boolean;
  wakeFailed?: boolean;
  connecting?: boolean;
}): HarnessStatus {
  if (input.permissionBlocked) {
    return { kind: 'permission-blocked', detail: 'A session is waiting on Allow, Always, or Deny.' };
  }
  if (input.cloudSession) {
    return { kind: 'cloud-session-running', detail: 'A Cloud session is running.' };
  }
  if (input.wakeFailed) {
    return { kind: 'failed-wake', detail: 'The remote Code host did not come back.' };
  }
  if (input.connecting) {
    return { kind: 'connecting', detail: 'Connecting to the Code host…' };
  }

  const remote = remoteHost();
  if (isBrowserSurface()) {
    if (remote) return { kind: 'connected', hostLabel: hostLabelFrom(remote) };
    if (!input.authenticated) {
      return { kind: 'cloud-only', detail: 'The browser cannot run the local harness.' };
    }
    return { kind: 'cloud-only', detail: 'Cloud-only on the web, or connect a Cortex Code host.' };
  }

  if (remote) return { kind: 'connected', hostLabel: hostLabelFrom(remote) };
  return { kind: 'connected', hostLabel: desktopHostLabel() };
}

function hostLabelFrom(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function desktopHostLabel(): string {
  const platform = chromePlatform();
  if (platform === 'darwin') return 'this Mac';
  if (platform === 'win32') return 'this PC';
  if (platform === 'linux') return 'this machine';
  return 'this device';
}
