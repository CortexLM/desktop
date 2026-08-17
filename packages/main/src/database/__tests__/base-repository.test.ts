import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../index.js';
import { toJSONColumn, fromJSONColumn } from '../repositories/base-repository.js';
import type { AutomationTrigger, WorkspaceSettings } from '../types.js';

/**
 * `applyUpdate` / `collectUpdates` sont protégés : on les exerce à travers un
 * repository réel plutôt que d'exposer l'implémentation.
 */
describe('BaseRepository behaviour (via repositories)', () => {
  let db: DatabaseManager;

  beforeEach(async () => {
    db = await DatabaseManager.create(':memory:');
    await db.initialize();
  });

  afterEach(() => {
    db.close();
  });

  const workspace = () => db.createWorkspace({ name: 'ws', path: `/tmp/${Math.random()}` });

  /** Trigger manuel minimal valide (`config` est requis). */
  const manualTrigger = (): AutomationTrigger => ({ type: 'manual', config: {} });

  describe('partial updates', () => {
    it('updates only the provided fields', () => {
      const created = db.createWorkspace({ name: 'before', path: '/tmp/a' });

      db.updateWorkspace(created.id, { name: 'after' });

      const found = db.getWorkspace(created.id)!;
      expect(found.name).toBe('after');
      expect(found.path).toBe('/tmp/a');
    });

    it('leaves other fields untouched across successive updates', () => {
      const created = db.createWorkspace({ name: 'n1', path: '/tmp/b' });

      db.updateWorkspace(created.id, { name: 'n2' });
      db.updateWorkspace(created.id, { path: '/tmp/c' });

      const found = db.getWorkspace(created.id)!;
      expect(found.name).toBe('n2');
      expect(found.path).toBe('/tmp/c');
    });

    it('treats an absent field as "do not touch"', () => {
      const created = db.createWorkspace({
        name: 'keep',
        path: '/tmp/d',
        settings: { theme: 'dark' },
      });

      db.updateWorkspace(created.id, { name: 'renamed' });

      expect(db.getWorkspace(created.id)!.settings).toEqual({ theme: 'dark' });
    });

    it('affects nothing when the id does not exist', () => {
      db.updateWorkspace('missing-id', { name: 'x' });

      expect(db.listWorkspaces()).toEqual([]);
    });
  });

  describe('JSON columns', () => {
    it('round-trips a nested object', () => {
      const settings: WorkspaceSettings = {
        theme: 'dark',
        editor: { fontSize: 13, tabSize: 4, wordWrap: true },
        git: { autoFetch: false, defaultBranch: 'main' },
      };
      const created = db.createWorkspace({ name: 'json', path: '/tmp/e', settings });

      expect(db.getWorkspace(created.id)!.settings).toEqual(settings);
    });

    it('stores an absent JSON column as undefined', () => {
      const created = db.createWorkspace({ name: 'nojson', path: '/tmp/f' });

      expect(db.getWorkspace(created.id)!.settings).toBeUndefined();
    });

    it('replaces the whole JSON payload on update', () => {
      const created = db.createWorkspace({
        name: 'json',
        path: '/tmp/g',
        settings: { theme: 'dark', editor: { tabSize: 4 } },
      });

      db.updateWorkspace(created.id, { settings: { theme: 'light' } });

      // Remplacement, pas fusion : `editor` disparaît
      expect(db.getWorkspace(created.id)!.settings).toEqual({ theme: 'light' });
    });
  });

  describe('SQLite boolean mapping', () => {
    it('round-trips enabled=true', () => {
      const ws = workspace();
      const created = db.createAutomation({
        workspace_id: ws.id,
        name: 'a',
        enabled: true,
        trigger: manualTrigger(),
        actions: [],
      });

      expect(db.getAutomation(created.id)!.enabled).toBe(true);
    });

    it('round-trips enabled=false', () => {
      const ws = workspace();
      const created = db.createAutomation({
        workspace_id: ws.id,
        name: 'a',
        enabled: false,
        trigger: manualTrigger(),
        actions: [],
      });

      expect(db.getAutomation(created.id)!.enabled).toBe(false);
    });

    it('toggles enabled through update', () => {
      const ws = workspace();
      const created = db.createAutomation({
        workspace_id: ws.id,
        name: 'a',
        enabled: true,
        trigger: manualTrigger(),
        actions: [],
      });

      db.updateAutomation(created.id, { enabled: false });

      expect(db.getAutomation(created.id)!.enabled).toBe(false);
    });

    it('filters on enabled via enabledOnly', () => {
      const ws = workspace();
      db.createAutomation({
        workspace_id: ws.id,
        name: 'on',
        enabled: true,
        trigger: manualTrigger(),
        actions: [],
      });
      db.createAutomation({
        workspace_id: ws.id,
        name: 'off',
        enabled: false,
        trigger: manualTrigger(),
        actions: [],
      });

      const enabled = db.listAutomations(ws.id, true);

      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe('on');
    });
  });

  describe('repository accessors', () => {
    it('exposes the same data through the façade and the repository', () => {
      const created = db.createWorkspace({ name: 'dual', path: '/tmp/h' });

      expect(db.workspaces.get(created.id)).toEqual(db.getWorkspace(created.id));
    });

    it('exposes every entity repository', () => {
      expect(db.workspaces).toBeDefined();
      expect(db.sessions).toBeDefined();
      expect(db.messages).toBeDefined();
      expect(db.missions).toBeDefined();
      expect(db.automations).toBeDefined();
      expect(db.usageLogs).toBeDefined();
    });
  });
});

describe('JSON column helpers', () => {
  it('serialises a value', () => {
    expect(toJSONColumn({ a: 1 })).toBe('{"a":1}');
  });

  it('maps undefined and null to a SQL NULL', () => {
    expect(toJSONColumn(undefined)).toBeNull();
    expect(toJSONColumn(null)).toBeNull();
  });

  it('serialises falsy-but-present values', () => {
    expect(toJSONColumn(0)).toBe('0');
    expect(toJSONColumn(false)).toBe('false');
  });

  it('parses a stored value', () => {
    expect(fromJSONColumn<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('maps NULL and empty string back to undefined', () => {
    expect(fromJSONColumn(null)).toBeUndefined();
    expect(fromJSONColumn(undefined)).toBeUndefined();
    expect(fromJSONColumn('')).toBeUndefined();
  });
});
