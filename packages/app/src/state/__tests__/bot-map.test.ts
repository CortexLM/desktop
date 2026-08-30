import { describe, expect, it } from 'vitest';

import {
  computerIsMissing,
  computerIsOffline,
  computerLabel,
  isPendingAsk,
  isPendingSecret,
  mapComputer,
  mapMascot,
  mapMessage,
  mapVideo,
} from '../bot-map.ts';

describe('mapMascot', () => {
  it('fills honest defaults and keeps farm extras off the model', () => {
    const mascot = mapMascot({ id: 'mst_1', extra: true });
    expect(mascot.name).toBe('Untitled mascot');
    expect(mascot.look).toBe('meadow');
    expect(mascot.face).toBe('idle');
    expect(mascot.unread).toBe(false);
    expect(mascot.computer.id).toBe('pc_mst_1');
  });

  it('claims no computer when the service described none', () => {
    const mascot = mapMascot({ id: 'mst_1' });
    expect(mascot.computer.status).toBe('empty');
    expect(mascot.computer.spec).toBeUndefined();
    expect(computerIsMissing(mascot.computer)).toBe(true);
    expect(computerLabel(mascot.computer)).toBe('No computer yet');
  });

  it('treats a bare computer_id as a machine that exists but is asleep', () => {
    const mascot = mapMascot({ id: 'mst_1', computer_id: 'pc_9' });
    expect(mascot.computer.status).toBe('hibernated');
    expect(computerIsMissing(mascot.computer)).toBe(false);
    expect(computerLabel(mascot.computer)).toBe('Asleep');
  });

  it('maps a look, resting face, and nested computer fields', () => {
    const mascot = mapMascot({
      id: 'mst_2',
      name: '  Scout  ',
      look: 'plum',
      face: 'wink',
      unread: true,
      created_at: '2026-01-01T00:00:00.000Z',
      computer: {
        id: 'pc_9',
        mascot_id: 'mst_2',
        status: 'running',
        provider: 'farm',
        last_error: 'none',
        screenshot_url: 'https://shot',
        arch: 'arm64',
        vcpu: 8,
        memory_gib: 32,
      },
    });
    expect(mascot.name).toBe('Scout');
    expect(mascot.look).toBe('plum');
    expect(mascot.face).toBe('wink');
    expect(mascot.unread).toBe(true);
    expect(mascot.createdAt).toBeGreaterThan(0);
    expect(mascot.computer.provider).toBe('farm');
    expect(mascot.computer.lastError).toBe('none');
    expect(mascot.computer.screenshotUrl).toBe('https://shot');
    expect(mascot.computer.spec?.vcpu).toBe(8);
  });

  it('maps legacy colour and shape onto look and face', () => {
    expect(mapMascot({ id: 'a', color: 'green', shape: 'round' }).look).toBe('meadow');
    expect(mapMascot({ id: 'b', color: 'ink', shape: 'tall' }).face).toBe('idle');
    expect(mapMascot({ id: 'c', color: 'teal', shape: 'narrow' }).look).toBe('teal');
    expect(mapMascot({ id: 'd', look: 'amber', resting_face: 'wink' }).face).toBe('wink');
    expect(mapMascot({ id: 'e', unread_count: 2 }).unread).toBe(true);
  });
});

describe('mapComputer', () => {
  it('maps stream url, control holder, and runtime', () => {
    const computer = mapComputer(
      { id: 'm' },
      {
        status: 'running',
        stream_url: 'https://farm.example/vnc',
        control_holder: 'user',
        runtime: 'this_pc',
      },
    );
    expect(computer.streamUrl).toBe('https://farm.example/vnc');
    expect(computer.controlHolder).toBe('user');
    expect(computer.runtime).toBe('this_pc');
    expect(computerLabel(computer)).toBe('This PC');
  });

  it('treats mock and offline boxes as offline', () => {
    expect(mapComputer({ id: 'm' }, { provider: 'mock' }).status).toBe('offline');
    expect(mapComputer({ id: 'm' }, { offline: true }).status).toBe('offline');
    expect(mapComputer({ id: 'm' }, { status: 'wake_failed' }).status).toBe('wake-failed');
    expect(mapComputer({ id: 'm' }, { status: 'connecting' }).status).toBe('waking');
    expect(mapComputer({ id: 'm', computer_id: 'pc_listed' }).id).toBe('pc_listed');
  });
});

describe('mapMessage', () => {
  it('classifies ask, secret, work, and user kinds', () => {
    expect(mapMessage({ kind: 'ask-user', text: 'Wake?' }, 1).kind).toBe('ask_user');
    expect(mapMessage({ kind: 'secret_request', secret: { name: 'token' } }, 2).secret?.name).toBe(
      'token',
    );
    expect(mapMessage({ kind: 'tool_call', tool: 'shell' }, 3).work?.tool).toBe('shell');
    expect(mapMessage({ role: 'user', content: 'hi' }, 4).kind).toBe('user');
    expect(mapMessage({ role: 'assistant', text: 'ok' }, 5).kind).toBe('send_to_user');
    expect(mapMessage({ ask_user: { prompt: 'Go?', options: ['yes'] } }, 6).ask?.prompt).toBe('Go?');
    expect(mapMessage({ secret: { reason: 'key' } }, 7).kind).toBe('secret');
    expect(mapMessage({ tool: 'fs' }, 8).kind).toBe('work');
  });
});

describe('videos and pending flags', () => {
  it('defaults a recording title and pending asks', () => {
    expect(mapVideo({ id: 'vid_1' }).title).toBe('Recording');
    expect(mapVideo({ id: 'vid_2', title: 'Clip', kind: 'zoom', created_at: '2026-01-02' }).kind).toBe(
      'zoom',
    );
    expect(isPendingAsk({ kind: 'ask_user', ask: { prompt: 'x', pending: true } } as never)).toBe(true);
    expect(isPendingAsk({ kind: 'ask_user' } as never)).toBe(true);
    expect(isPendingSecret({ kind: 'secret', secret: { name: 't', pending: false } } as never)).toBe(
      false,
    );
    expect(isPendingSecret({ kind: 'secret' } as never)).toBe(true);
    expect(computerIsOffline({ status: 'offline' } as never)).toBe(true);
    expect(computerIsOffline({ status: 'running', provider: 'mock' } as never)).toBe(true);
    expect(computerIsOffline({ status: 'running' } as never)).toBe(false);
    expect(computerLabel({ status: 'running' } as never).toLowerCase()).not.toMatch(
      /\bthis pc\b|\bthis desktop\b/,
    );
  });
});
