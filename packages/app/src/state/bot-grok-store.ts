/**
 * Memory, skills, routines, groups. Each load hits the API. A 404 becomes
 * "backend too old" — the store stays empty and does not invent rows.
 */

import { createSignal } from 'solid-js';

import {
  classifyBotError,
  createRoutine,
  DEFAULT_ROUTINE_CRON,
  forgetMemory,
  getSkill,
  listBotGroups,
  listBotInbox,
  listMemory,
  listRoutines,
  listSkills,
  pauseRoutine,
  postHandoff,
  postTeach,
  resumeRoutine,
  runSkill,
  type ApiBotGroup,
  type ApiBotInboxItem,
  type ApiMemoryFact,
  type ApiRoutine,
  type ApiSkill,
} from '@cortex-ide/cortex-api';

import { requireBotClient } from './bot-client.ts';

export type GrokPanelState = 'idle' | 'ready' | 'error' | 'too-old';

const [memory, setMemory] = createSignal<ApiMemoryFact[]>([]);
const [skills, setSkills] = createSignal<ApiSkill[]>([]);
const [routines, setRoutines] = createSignal<ApiRoutine[]>([]);
const [groups, setGroups] = createSignal<ApiBotGroup[]>([]);
const [inbox, setInbox] = createSignal<ApiBotInboxItem[]>([]);
const [skillDoc, setSkillDoc] = createSignal<ApiSkill | undefined>();
const [panelState, setPanelState] = createSignal<GrokPanelState>('idle');
const [panelError, setPanelError] = createSignal('');

export { memory, skills, routines, groups, inbox, skillDoc, panelState, panelError };
export { DEFAULT_ROUTINE_CRON };

export async function loadMemory(mascotId: string): Promise<void> {
  await runPanel(async () => {
    const client = requireBotClient();
    const [profile, log] = await Promise.all([
      listMemory(client, mascotId, 'profile'),
      listMemory(client, mascotId, 'log'),
    ]);
    setMemory([...profile, ...log]);
  });
}

export async function forgetFact(mascotId: string, factId: string, tier: 'profile' | 'log'): Promise<void> {
  await forgetMemory(requireBotClient(), mascotId, { factId, tier });
  setMemory((rows) => rows.filter((row) => row.id !== factId));
}

export async function loadSkills(): Promise<void> {
  await runPanel(async () => {
    setSkills(await listSkills(requireBotClient()));
  });
}

export async function openSkill(slug: string): Promise<void> {
  setSkillDoc(await getSkill(requireBotClient(), slug));
}

export async function runMascotSkill(mascotId: string, slug: string): Promise<void> {
  await runSkill(requireBotClient(), mascotId, slug);
}

export async function loadRoutines(mascotId: string): Promise<void> {
  await runPanel(async () => {
    setRoutines(await listRoutines(requireBotClient(), mascotId));
  });
}

export async function addRoutine(mascotId: string, name: string, cron?: string): Promise<void> {
  const created = await createRoutine(requireBotClient(), mascotId, {
    name,
    cron: cron?.trim() || DEFAULT_ROUTINE_CRON,
  });
  setRoutines((rows) => [created, ...rows]);
}

export async function toggleRoutine(mascotId: string, routine: ApiRoutine): Promise<void> {
  const client = requireBotClient();
  const next =
    routine.paused || routine.status === 'paused'
      ? await resumeRoutine(client, mascotId, routine.id)
      : await pauseRoutine(client, mascotId, routine.id);
  setRoutines((rows) => rows.map((row) => (row.id === routine.id ? next : row)));
}

export async function loadGroups(mascotId: string): Promise<void> {
  await runPanel(async () => {
    const client = requireBotClient();
    const [groupRows, inboxRows] = await Promise.all([
      listBotGroups(client, mascotId),
      listBotInbox(client, mascotId),
    ]);
    setGroups(groupRows);
    setInbox(inboxRows);
  });
}

export async function handoffTo(mascotId: string, toMascotId: string, message?: string): Promise<void> {
  await postHandoff(requireBotClient(), mascotId, { to_mascot_id: toMascotId, message });
}

export async function teachFromVideo(mascotId: string, videoId: string): Promise<void> {
  await postTeach(requireBotClient(), mascotId, { video_id: videoId });
  await loadSkills();
}

export function resetGrokForTests(): void {
  setMemory([]);
  setSkills([]);
  setRoutines([]);
  setGroups([]);
  setInbox([]);
  setSkillDoc(undefined);
  setPanelState('idle');
  setPanelError('');
}

async function runPanel(work: () => Promise<void>): Promise<void> {
  try {
    await work();
    setPanelState('ready');
    setPanelError('');
  } catch (error) {
    const classified = classifyBotError(error);
    setPanelState(classified.code === 'backend_too_old' ? 'too-old' : 'error');
    setPanelError(classified.message);
    setMemory([]);
    setSkills([]);
    setRoutines([]);
    setGroups([]);
    setInbox([]);
  }
}
