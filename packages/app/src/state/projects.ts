/**
 * Chat projects and their sources, held on the account.
 *
 * `/v1/projects` is one of the few product routes that answered on the live
 * service, so there was never a reason for this to be a `localStorage` array — a
 * project the user's other machine cannot open is not a project, and "Add source"
 * that appended `{ label: 'Untitled source' }` locally was a placeholder wearing a
 * feature's clothes.
 *
 * Sources are loaded per project rather than embedded in the list: the list route
 * does not carry them, and inventing a count would misreport how much context a
 * project actually has.
 */

import { createSignal } from 'solid-js';

import {
  createProject as createProjectRemote,
  createProjectSource,
  deleteProject as deleteProjectRemote,
  deleteProjectSource,
  getProject,
  listProjects,
  listProjectSources,
  patchProject,
  type ApiProject,
  type ApiProjectSource,
} from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import { createRemoteCollection, type RemoteState } from './remote-collection.ts';

export type ProjectSourceKind = 'file' | 'folder' | 'plugin' | 'url';

export interface ProjectSource {
  id: string;
  label: string;
  kind: ProjectSourceKind;
}

export interface ChatProject {
  id: string;
  title: string;
  brief: string;
  updatedAt: number;
  sources: ProjectSource[];
}

const SOURCE_KINDS: readonly ProjectSourceKind[] = ['file', 'folder', 'plugin', 'url'];

function toSourceKind(value: string | undefined): ProjectSourceKind {
  return SOURCE_KINDS.find((kind) => kind === value) ?? 'url';
}

function readString(row: object, key: string): string | undefined {
  const value = (row as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

export function toChatProject(row: ApiProject): ChatProject {
  const updated = readString(row, 'updated_at');
  const parsed = updated ? Date.parse(updated) : Number.NaN;
  return {
    id: row.id ?? row.name ?? row.title ?? 'project',
    title: row.title ?? row.name ?? 'Untitled project',
    brief: readString(row, 'brief') ?? '',
    updatedAt: Number.isNaN(parsed) ? 0 : parsed,
    // Sources arrive from the per-project route; an empty array here means
    // "not loaded", which is why the detail screen fetches them itself.
    sources: [],
  };
}

export function toProjectSource(row: ApiProjectSource): ProjectSource {
  return { id: row.id, label: row.label ?? row.url ?? 'Source', kind: toSourceKind(row.kind) };
}

const collection = createRemoteCollection<ChatProject>({
  label: 'Projects',
  load: async (client) => (await listProjects(client)).map(toChatProject),
});

export const chatProjects = collection.items;
export const projectsState = collection.state;
export const projectsError = collection.error;
export const loadProjects = collection.reload;

export async function createProject(title: string, brief = ''): Promise<string | undefined> {
  const client = botClient();
  if (!client) throw new Error('Projects need a connection to Cortex.');
  const created = await createProjectRemote(client, title.trim() || 'Untitled project');
  const project = toChatProject(created);
  if (brief.trim()) await patchProject(client, project.id, { brief: brief.trim() });
  await collection.reload();
  return project.id;
}

export function renameProject(id: string, title: string, brief?: string): Promise<void> {
  return collection.mutate((client) =>
    patchProject(client, id, {
      name: title,
      ...(brief === undefined ? {} : { brief }),
    }),
  );
}

export function removeProject(id: string): Promise<void> {
  return collection.mutate((client) => deleteProjectRemote(client, id));
}

/* ------------------------------------------------------------------------- */
/* One project's detail and sources                                          */
/* ------------------------------------------------------------------------- */

const [openProject, setOpenProject] = createSignal<ChatProject | undefined>();
const [projectState, setProjectState] = createSignal<RemoteState>('idle');
const [projectError, setProjectError] = createSignal('');

export { openProject, projectState, projectError };

/**
 * Loads one project and its sources.
 *
 * The two reads are issued together: a project header that paints before its
 * source count arrives shows "0 sources" for a frame, which reads as a project
 * with nothing in it.
 */
export async function loadProject(id: string): Promise<void> {
  const client = botClient();
  if (!client) {
    setOpenProject(undefined);
    setProjectState('disconnected');
    setProjectError('Projects need a connection to Cortex.');
    return;
  }

  setProjectState('loading');
  setProjectError('');
  try {
    const [detail, sources] = await Promise.all([
      getProject(client, id),
      listProjectSources(client, id).catch(() => [] as ApiProjectSource[]),
    ]);
    setOpenProject({ ...toChatProject(detail), sources: sources.map(toProjectSource) });
    setProjectState('ready');
  } catch (error) {
    setOpenProject(undefined);
    setProjectState('error');
    setProjectError(error instanceof Error ? error.message : String(error));
  }
}

export async function addProjectSource(
  projectId: string,
  source: { label: string; kind: ProjectSourceKind; url?: string },
): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('Projects need a connection to Cortex.');
  await createProjectSource(client, projectId, {
    label: source.label,
    kind: source.kind,
    ...(source.url ? { url: source.url } : {}),
  });
  await loadProject(projectId);
}

export async function removeProjectSource(projectId: string, sourceId: string): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('Projects need a connection to Cortex.');
  await deleteProjectSource(client, projectId, sourceId);
  await loadProject(projectId);
}

export function resetProjectsForTests(): void {
  collection.reset();
  setOpenProject(undefined);
  setProjectState('idle');
  setProjectError('');
}
