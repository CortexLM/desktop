/**
 * This PC: a folder on this machine is the workspace. Cloud and SSH never
 * share this path. The renderer never sees the absolute directory.
 */

import { dialog } from 'electron';

export const THIS_PC_NEEDS_FOLDER =
  'Open a folder on this computer first. This PC runs against that tree, not a cloud workspace.';

export const FOLDER_PICKER = {
  properties: ['openDirectory', 'createDirectory'] as const,
  title: 'Open a folder to run agents in',
};

export function isRemoteRuntime(runtime: string): boolean {
  return runtime === 'cloud' || runtime === 'ssh';
}

/** The disk root the local agent may touch. Throws rather than falling back to cwd. */
export function requireThisPcFolder(path: string | undefined): string {
  const trimmed = path?.trim();
  if (!trimmed) throw new Error(THIS_PC_NEEDS_FOLDER);
  return trimmed;
}

/** Native directory picker. Undefined means the user cancelled. */
export async function pickLocalFolder(): Promise<string | undefined> {
  const result = await dialog.showOpenDialog({
    properties: [...FOLDER_PICKER.properties],
    title: FOLDER_PICKER.title,
  });
  const chosen = result.filePaths[0];
  if (result.canceled || !chosen) return undefined;
  return chosen;
}
