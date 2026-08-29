import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Message, Session } from '@cortex-ide/shared';

import { ChatExportService, getChatExportService } from '../chat-export-service';

const session: Session = {
  id: 'ses_1',
  workspaceId: 'ws_1',
  title: 'Hello World!',
  model: 'gpt-4.1',
  createdAt: Date.parse('2026-01-02T00:00:00.000Z'),
  updatedAt: Date.parse('2026-01-02T00:00:00.000Z'),
};

const messages: Message[] = [
  {
    id: 'm1',
    sessionId: 'ses_1',
    role: 'user',
    content: 'Hi <there>',
    createdAt: Date.parse('2026-01-02T00:00:00.000Z'),
    metadata: { source: 'composer' },
  },
  {
    id: 'm2',
    sessionId: 'ses_1',
    role: 'assistant',
    content: 'Ready.',
    createdAt: Date.parse('2026-01-02T00:01:00.000Z'),
  },
];

const service = new ChatExportService();

describe('ChatExportService', () => {
  it('exports markdown with metadata', async () => {
    const result = await service.exportSession(session, messages, { format: 'markdown' });
    expect(result.filename).toMatch(/chat-hello-world-2026-01-02\.md$/);
    expect(result.content).toContain('# Hello World!');
    expect(result.content).toContain('**Model:** gpt-4.1');
    expect(result.content).toContain('Hi <there>');
    expect(result.size).toBeGreaterThan(0);
  });

  it('exports pretty and compact JSON', async () => {
    const pretty = await service.exportSession(session, messages, {
      format: 'json',
      includeMetadata: true,
      prettify: true,
    });
    expect(pretty.filename).toMatch(/\.json$/);
    expect(JSON.parse(pretty.content).session.model).toBe('gpt-4.1');
    expect(pretty.content).toContain('\n');

    const compact = await service.exportSession(session, messages, {
      format: 'json',
      includeMetadata: false,
      prettify: false,
    });
    expect(JSON.parse(compact.content).session).toEqual({ id: 'ses_1', title: 'Hello World!' });
    expect(compact.content).not.toContain('\n  ');
  });

  it('exports HTML escaped text and plain text', async () => {
    const html = await service.exportSession(session, messages, {
      format: 'html',
      includeMetadata: true,
      includeTimestamps: false,
    });
    expect(html.filename).toMatch(/\.html$/);
    expect(html.content).toContain('Hi &lt;there&gt;');
    expect(html.content).toContain('<!DOCTYPE html>');

    const text = await service.exportSession(session, messages, {
      format: 'text',
      includeTimestamps: false,
    });
    expect(text.filename).toMatch(/\.txt$/);
    expect(text.content).toContain('USER:');
    expect(text.content).toContain('ASSISTANT:');
  });

  it('rejects an unknown format', async () => {
    await expect(
      service.exportSession(session, messages, { format: 'pdf' as 'markdown' }),
    ).rejects.toThrow(/Unsupported export format/);
  });

  it('writes the export to disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cortex-export-'));
    try {
      const result = await service.exportSession(session, messages, { format: 'text' });
      const path = await service.saveToFile(result, dir);
      expect(await readFile(path, 'utf8')).toBe(result.content);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('concatenates multiple sessions', async () => {
    const json = await service.exportMultipleSessions([{ session, messages }], {
      format: 'json',
      prettify: false,
    });
    expect(JSON.parse(json.content)).toHaveLength(1);

    const md = await service.exportMultipleSessions([{ session, messages }], { format: 'markdown' });
    expect(md.content).toContain('# Hello World!');
    expect(md.filename).toMatch(/\.md$/);

    const txt = await service.exportMultipleSessions([{ session, messages }], { format: 'text' });
    expect(txt.filename).toMatch(/\.txt$/);
  });

  it('reuses a singleton', () => {
    expect(getChatExportService()).toBe(getChatExportService());
  });
});
