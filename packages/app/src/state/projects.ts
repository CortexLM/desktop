/**
 * Chat projects and their sources. Empty until the user creates one —
 * no demo project presented as real.
 */

import { createSignal } from 'solid-js';

import { readJson, writeJson } from './persist.ts';

export interface ProjectSource {
  id: string;
  label: string;
  kind: 'file' | 'folder' | 'plugin' | 'url';
}

export interface ChatProject {
  id: string;
  title: string;
  brief: string;
  updatedAt: number;
  sources: ProjectSource[];
}

const STORAGE_KEY = 'cortex.projects.v1';

const [projects, setProjects] = createSignal<ChatProject[]>(readJson(STORAGE_KEY, []));

export { projects as chatProjects };

function persist(next: ChatProject[]): void {
  setProjects(next);
  writeJson(STORAGE_KEY, next);
}

export function createProject(title: string, brief = ''): ChatProject {
  const project: ChatProject = {
    id: `proj_${Date.now().toString(36)}`,
    title: title.trim() || 'Untitled project',
    brief: brief.trim(),
    updatedAt: Date.now(),
    sources: [],
  };
  persist([project, ...projects()]);
  return project;
}

export function projectById(id: string): ChatProject | undefined {
  return projects().find((project) => project.id === id);
}

export function addProjectSource(projectId: string, source: Omit<ProjectSource, 'id'>): void {
  persist(
    projects().map((project) => {
      if (project.id !== projectId) return project;
      const next: ProjectSource = { ...source, id: `src_${Date.now().toString(36)}` };
      return { ...project, sources: [...project.sources, next], updatedAt: Date.now() };
    }),
  );
}
