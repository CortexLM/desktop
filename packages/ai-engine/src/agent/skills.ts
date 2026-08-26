import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SkillDefinition } from './types';

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseSkillMarkdown(source: string, fallbackName: string): SkillDefinition {
  const match = source.match(FRONT_MATTER);
  const body = match ? match[2].trim() : source.trim();
  const meta: Record<string, string> = {};
  if (match) {
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  const name = (meta.name ?? fallbackName).replace(/^\//, '');
  return {
    name,
    description: meta.description ?? '',
    body,
  };
}

export function parseComposerPrefixes(input: string): {
  kind: 'prompt' | 'command' | 'shell' | 'snippet' | 'mention';
  value: string;
  rest: string;
} {
  const trimmed = input.trim();
  if (trimmed.startsWith('!')) {
    return { kind: 'shell', value: trimmed.slice(1).trim(), rest: '' };
  }
  if (trimmed.startsWith('/')) {
    const [name, ...rest] = trimmed.slice(1).split(/\s+/);
    return { kind: 'command', value: name ?? '', rest: rest.join(' ') };
  }
  if (trimmed.startsWith('#')) {
    return { kind: 'snippet', value: trimmed.slice(1).trim(), rest: '' };
  }
  if (trimmed.startsWith('@')) {
    const [name, ...rest] = trimmed.slice(1).split(/\s+/);
    return { kind: 'mention', value: name ?? '', rest: rest.join(' ') };
  }
  return { kind: 'prompt', value: trimmed, rest: '' };
}

export async function loadSkillsFromWorkspace(workspaceRoot: string): Promise<SkillDefinition[]> {
  const dirs = [
    path.join(workspaceRoot, '.cortex', 'skills'),
    path.join(workspaceRoot, '.cortex', 'commands'),
    path.join(workspaceRoot, '.factory', 'skills'),
  ];
  const skills: SkillDefinition[] = [];
  for (const dir of dirs) {
    const entries = await fs.readdir(dir).catch(() => []);
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const source = await fs.readFile(path.join(dir, entry), 'utf8');
      skills.push(parseSkillMarkdown(source, entry.replace(/\.md$/, '')));
    }
  }
  return skills;
}
