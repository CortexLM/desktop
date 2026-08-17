import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DroidDefinition } from './types';

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseDroidMarkdown(source: string, fallbackName: string): DroidDefinition {
  const match = source.match(FRONT_MATTER);
  const body = match ? match[2].trim() : source.trim();
  const meta = match ? parseYamlish(match[1]) : {};
  const tools = typeof meta.tools === 'string'
    ? meta.tools.split(/[,\s]+/).filter(Boolean)
    : Array.isArray(meta.tools)
      ? meta.tools.map(String)
      : undefined;

  return {
    name: String(meta.name ?? fallbackName),
    description: String(meta.description ?? ''),
    model: typeof meta.model === 'string' ? meta.model : undefined,
    tools,
    systemPrompt: body || `You are the ${fallbackName} droid. Complete the delegated task and return a concise result.`,
  };
}

export function generateDroidFromDescription(description: string): DroidDefinition {
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'helper';

  return {
    name: slug,
    description,
    tools: inferTools(description),
    systemPrompt: `You are a specialized Cortex droid created from this brief:\n\n${description.trim()}\n\nStay inside that brief. Use only the tools you need. Return a short report of what you did and what you found. Do not expand scope.`,
  };
}

export function serializeDroid(droid: DroidDefinition): string {
  const tools = droid.tools?.join(', ') ?? '';
  return `---
name: ${droid.name}
description: ${droid.description}
${droid.model ? `model: ${droid.model}\n` : ''}${tools ? `tools: ${tools}\n` : ''}---
${droid.systemPrompt}
`;
}

export async function loadDroidsFromWorkspace(workspaceRoot: string): Promise<DroidDefinition[]> {
  const dirs = [
    path.join(workspaceRoot, '.cortex', 'droids'),
    path.join(workspaceRoot, '.factory', 'droids'),
  ];
  const droids: DroidDefinition[] = [];
  for (const dir of dirs) {
    const entries = await fs.readdir(dir).catch(() => []);
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const source = await fs.readFile(path.join(dir, entry), 'utf8');
      droids.push(parseDroidMarkdown(source, entry.replace(/\.md$/, '')));
    }
  }
  return droids;
}

function inferTools(description: string): string[] {
  const text = description.toLowerCase();
  const tools = new Set<string>(['read', 'grep', 'glob']);
  if (/\b(edit|fix|implement|write|refactor)\b/.test(text)) {
    tools.add('edit');
    tools.add('write');
  }
  if (/\b(test|tests|lint|build|run|shell)\b/.test(text)) {
    tools.add('bash');
  }
  if (/\bgit\b/.test(text)) {
    tools.add('git');
  }
  return [...tools];
}

function parseYamlish(block: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of block.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
}
