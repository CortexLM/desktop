import { describe, expect, it } from 'vitest';

import { mascotIdFromPath, openBotStudio } from '../bot-sidebar.ts';

describe('mascotIdFromPath', () => {
  it('reads a live mascot id and ignores setup routes', () => {
    expect(mascotIdFromPath('/bot/mst_1')).toBe('mst_1');
    expect(mascotIdFromPath('/bot/mst_1/routines')).toBe('mst_1');
    expect(mascotIdFromPath('/bot/new')).toBeUndefined();
    expect(mascotIdFromPath('/bot/approvals')).toBeUndefined();
    expect(mascotIdFromPath('/bot')).toBeUndefined();
  });
});

describe('openBotStudio', () => {
  it('opens approvals globally and routines on the current mascot', () => {
    const paths: string[] = [];
    openBotStudio('approvals', '/bot/mst_1', (path) => paths.push(path));
    openBotStudio('routines', '/bot/mst_1', (path) => paths.push(path));
    openBotStudio('memory', '/bot', (path) => paths.push(path));
    expect(paths).toEqual(['/bot/approvals', '/bot/mst_1/routines', '/bot']);
  });
});
