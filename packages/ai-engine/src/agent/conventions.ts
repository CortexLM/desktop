import { promises as fs } from 'node:fs';
import path from 'node:path';

const CANDIDATES = ['AGENTS.md', 'agents.md', 'CLAUDE.md', '.cursorrules', 'CONTRIBUTING.md'];

export async function readProjectConventions(workspaceRoot: string): Promise<string> {
  const chunks: string[] = [];
  for (const name of CANDIDATES) {
    const file = path.join(workspaceRoot, name);
    try {
      const text = await fs.readFile(file, 'utf8');
      if (text.trim()) {
        chunks.push(`## ${name}\n${text.trim()}`);
      }
    } catch {
      // File is optional.
    }
  }
  return chunks.join('\n\n');
}
