import { describe, expect, it } from 'vitest';

import {
  askUserSchema,
  attachmentSchema,
  botMessageSchema,
  computerStatusSchema,
  filePreviewSchema,
  fsEntrySchema,
  mascotVideoSchema,
  secretRequestSchema,
  shellResultSchema,
} from '../bot-schemas.ts';
import {
  groupRowSchema,
  memoryTierSchema,
  pluginConnectionSchema,
  pluginRowSchema,
  skillRunSchema,
  taskRowSchema,
} from '../bot-grok-schemas.ts';
import { realtimeClientMessageSchema, realtimeEventSchema } from '../realtime/events.ts';

describe('bot schemas', () => {
  it('keeps optional computer and grok fields without inventing a farm', () => {
    expect(computerStatusSchema.parse('offline')).toBe('offline');
    expect(attachmentSchema.parse({ name: 'clip.mp4' }).name).toBe('clip.mp4');
    expect(askUserSchema.parse({ prompt: 'Wake?', options: ['yes'] }).pending).toBeUndefined();
    expect(secretRequestSchema.parse({ name: 'token' }).name).toBe('token');
    expect(botMessageSchema.parse({ kind: 'send_to_user', text: 'hi', extra: 1 }).extra).toBe(1);
    expect(mascotVideoSchema.parse({ id: 'vid_1', title: 'Clip' }).id).toBe('vid_1');
    expect(shellResultSchema.parse({ stdout: 'ok', exit_code: 0 }).exit_code).toBe(0);
    expect(fsEntrySchema.parse({ name: 'README.md' }).kind).toBeUndefined();
    expect(filePreviewSchema.parse({ path: '/a', content: 'x' }).content).toBe('x');
  });

  it('parses grok rows that a newer backend may send', () => {
    expect(memoryTierSchema.parse('note')).toBe('note');
    expect(skillRunSchema.parse({ status: 'started' }).status).toBe('started');
    expect(taskRowSchema.parse({ id: 'tsk_1', title: 'Scout' }).title).toBe('Scout');
    expect(groupRowSchema.parse({ id: 'grp_1', name: 'Ops' }).name).toBe('Ops');
    expect(pluginRowSchema.parse({ id: 'drive', connected: false }).connected).toBe(false);
    expect(pluginConnectionSchema.parse({ id: 'c1', plugin_id: 'slack' }).plugin_id).toBe('slack');
  });

  it('accepts Bot realtime frames and client messages', () => {
    expect(realtimeEventSchema.parse({ type: 'ask_user', ask_id: 'a1' }).ask_id).toBe('a1');
    expect(realtimeEventSchema.parse({ type: 'computer_offline' }).type).toBe('computer_offline');
    expect(
      realtimeClientMessageSchema.parse({ type: 'chat.turn', message: 'hi', decision: 'allow' }).decision,
    ).toBe('allow');
  });
});
