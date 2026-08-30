/**
 * Live computer attachments: screenshot poll, shell, and file preview.
 * Offline / mock providers stay on one honest empty state.
 */

import { createSignal } from 'solid-js';

import {
  classifyBotError,
  getScreenshot,
  listComputerFs,
  postShell,
  readComputerFile,
  type ApiFilePreview,
  type ApiFsEntry,
  type ApiScreenshot,
  type ApiShellResult,
} from '@cortex-ide/cortex-api';

import { requireBotClient } from './bot-client.ts';

const [shot, setShot] = createSignal<ApiScreenshot | undefined>();
const [fsEntries, setFsEntries] = createSignal<ApiFsEntry[]>([]);
const [preview, setPreview] = createSignal<ApiFilePreview | undefined>();
const [shellLog, setShellLog] = createSignal('');
const [boxError, setBoxError] = createSignal('');
const [recording, setRecordingFlag] = createSignal(false);
const [ownerId, setOwnerId] = createSignal<string | undefined>();

export { shot, fsEntries, preview, shellLog, boxError, recording };

export function attachComputer(mascotId: string | undefined): void {
  if (ownerId() === mascotId) return;
  setOwnerId(mascotId);
  setShot(undefined);
  setFsEntries([]);
  setPreview(undefined);
  setShellLog('');
  setBoxError('');
  setRecordingFlag(false);
}

export function shotFor(mascotId: string | undefined): ApiScreenshot | undefined {
  if (!mascotId || ownerId() !== mascotId) return undefined;
  return shot();
}

export function setRecordingFlagValue(value: boolean): void {
  setRecordingFlag(value);
}

export async function refreshScreenshot(mascotId: string): Promise<void> {
  try {
    const image = await getScreenshot(requireBotClient(), mascotId);
    if (!stillOn(mascotId)) return;
    setShot(image);
    setBoxError('');
  } catch (error) {
    if (!stillOn(mascotId)) return;
    setBoxError(classifyBotError(error).message);
  }
}

export async function runShell(mascotId: string, command: string): Promise<ApiShellResult | undefined> {
  try {
    const result = await postShell(requireBotClient(), mascotId, command);
    if (!stillOn(mascotId)) return result;
    const chunk = [result.stdout, result.stderr].filter(Boolean).join('\n');
    setShellLog((current) => `${current}$ ${command}\n${chunk}\n`);
    setBoxError('');
    return result;
  } catch (error) {
    if (!stillOn(mascotId)) return undefined;
    setBoxError(classifyBotError(error).message);
    return undefined;
  }
}

export async function loadFs(mascotId: string, path = '/'): Promise<void> {
  try {
    const entries = await listComputerFs(requireBotClient(), mascotId, path);
    if (!stillOn(mascotId)) return;
    setFsEntries(entries);
    setBoxError('');
  } catch (error) {
    if (!stillOn(mascotId)) return;
    setBoxError(classifyBotError(error).message);
  }
}

export async function openFile(mascotId: string, path: string): Promise<void> {
  try {
    const file = await readComputerFile(requireBotClient(), mascotId, path);
    if (!stillOn(mascotId)) return;
    setPreview(file);
    setBoxError('');
  } catch (error) {
    if (!stillOn(mascotId)) return;
    setBoxError(classifyBotError(error).message);
  }
}

function stillOn(mascotId: string): boolean {
  return ownerId() === mascotId;
}

export function screenshotSrc(image: ApiScreenshot | undefined): string | undefined {
  if (!image) return undefined;
  if (image.url) return image.url;
  if (image.image_base64) {
    const type = image.content_type ?? 'image/png';
    return `data:${type};base64,${image.image_base64}`;
  }
  return undefined;
}
