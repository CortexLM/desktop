/**
 * Oversized tool output is offloaded. The model sees a stub and pages the
 * body with Read / Grep using `artifact_id`. Compaction keeps those ids.
 */

import type { ArtifactHost, ArtifactStub } from './types';

export const DEFAULT_ARTIFACT_THRESHOLD = 32 * 1024;
export const DEFAULT_ARTIFACT_PREVIEW_LINES = 80;

export interface ArtifactRecord {
  id: string;
  tool: string;
  text: string;
  createdAt: number;
}

export class ArtifactStore implements ArtifactHost {
  private readonly items = new Map<string, ArtifactRecord>();
  private readonly threshold: number;
  private readonly previewLines: number;
  private next = 1;

  constructor(options?: { threshold?: number; previewLines?: number }) {
    this.threshold = options?.threshold ?? DEFAULT_ARTIFACT_THRESHOLD;
    this.previewLines = options?.previewLines ?? DEFAULT_ARTIFACT_PREVIEW_LINES;
  }

  offload(tool: string, output: string): ArtifactStub {
    if (output.length <= this.threshold) return { output };
    const id = `art_${this.next}`;
    this.next += 1;
    this.items.set(id, { id, tool, text: output, createdAt: Date.now() });
    return { output: stubFor(id, tool, output, this.previewLines), artifact_id: id };
  }

  get(id: string): ArtifactRecord | undefined {
    return this.items.get(id);
  }

  readPage(id: string, offset = 1, limit = DEFAULT_ARTIFACT_PREVIEW_LINES): string | undefined {
    const record = this.items.get(id);
    if (!record) return undefined;
    const lines = record.text.split('\n');
    const start = Math.max(1, offset);
    const slice = lines.slice(start - 1, start - 1 + limit);
    const numbered = slice.map((line, index) => `${start + index}|${line}`).join('\n');
    return `artifact ${id} · lines ${start}–${start + slice.length - 1} of ${lines.length}\n${numbered}`;
  }

  grep(id: string, pattern: string): string | undefined {
    const record = this.items.get(id);
    if (!record) return undefined;
    const regex = new RegExp(pattern);
    const hits: string[] = [];
    record.text.split('\n').forEach((line, index) => {
      if (regex.test(line)) hits.push(`${index + 1}:${line}`);
    });
    return hits.slice(0, 200).join('\n') || `No matches in artifact ${id}`;
  }

  ids(): string[] {
    return [...this.items.keys()];
  }
}

function stubFor(id: string, tool: string, output: string, previewLines: number): string {
  const lines = output.split('\n');
  const preview = lines.slice(0, previewLines).join('\n');
  const omitted = Math.max(0, lines.length - previewLines);
  return [
    `[artifact ${id} · ${output.length} bytes · ${tool}]`,
    preview,
    `[... ${omitted} more lines. Read or Grep this artifact with artifact_id="${id}".]`,
  ].join('\n');
}
