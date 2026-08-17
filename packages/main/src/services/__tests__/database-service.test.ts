/**
 * Tests - DatabaseService (query / execute)
 *
 * Couvre la régression : les handlers `dbQuery` / `dbExecute` levaient
 * "Database handlers not yet implemented".
 *
 * Vérifie aussi les garde-fous de sécurité : les handlers IPC étant
 * atteignables depuis le renderer, on ne doit pas pouvoir y exécuter du SQL
 * arbitraire (écritures via query(), DROP/ALTER, statements empilés).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from '../database-service';

describe('DatabaseService', () => {
  let tempDir: string;
  let service: DatabaseService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cortex-db-test-'));
    service = new DatabaseService(join(tempDir, 'test.db'));
    await service.initialize();
  });

  afterEach(async () => {
    service.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('crée le schéma via les migrations', async () => {
      const { rows } = await service.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      );

      const tables = rows.map((r) => r.name);
      expect(tables).toContain('workspaces');
      expect(tables).toContain('sessions');
      expect(tables).toContain('messages');
      expect(tables).toContain('automations');
    });

    it('est idempotent et réutilise la même connexion', async () => {
      const first = await service.initialize();
      const second = await service.initialize();

      expect(second).toBe(first);
    });
  });

  describe('query', () => {
    it('retourne les données insérées', async () => {
      const manager = await service.getManager();
      const workspace = manager.createWorkspace({
        name: 'Projet Test',
        path: '/tmp/projet-test',
      });

      const { rows } = await service.query<{ id: string; name: string; path: string }>(
        'SELECT id, name, path FROM workspaces WHERE id = ?',
        [workspace.id]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Projet Test');
      expect(rows[0].path).toBe('/tmp/projet-test');
    });

    it('retourne plusieurs lignes ordonnées', async () => {
      const manager = await service.getManager();
      manager.createWorkspace({ name: 'A', path: '/a' });
      manager.createWorkspace({ name: 'B', path: '/b' });
      manager.createWorkspace({ name: 'C', path: '/c' });

      const { rows } = await service.query<{ name: string }>(
        'SELECT name FROM workspaces ORDER BY name ASC'
      );

      expect(rows.map((r) => r.name)).toEqual(['A', 'B', 'C']);
    });

    it('retourne un tableau vide sans résultat (pas une erreur)', async () => {
      const { rows } = await service.query('SELECT * FROM workspaces WHERE id = ?', ['absent']);

      expect(rows).toEqual([]);
    });

    it('lie les paramètres (protection injection SQL)', async () => {
      const manager = await service.getManager();
      manager.createWorkspace({ name: 'Safe', path: '/safe' });

      // La valeur est traitée comme une donnée, pas comme du SQL
      const { rows } = await service.query("SELECT * FROM workspaces WHERE name = ?", [
        "Safe' OR '1'='1",
      ]);

      expect(rows).toHaveLength(0);
    });

    it('supporte les agrégats et les JOIN', async () => {
      const manager = await service.getManager();
      const workspace = manager.createWorkspace({ name: 'WS', path: '/ws' });
      const session = manager.createSession({
        workspace_id: workspace.id,
        title: 'Session 1',
        model: 'test-model',
      });
      manager.createMessage({ session_id: session.id, role: 'user', content: 'salut' });
      manager.createMessage({ session_id: session.id, role: 'assistant', content: 'bonjour' });

      const { rows } = await service.query<{ title: string; message_count: number }>(
        `SELECT s.title, COUNT(m.id) as message_count
         FROM sessions s
         LEFT JOIN messages m ON m.session_id = s.id
         WHERE s.workspace_id = ?
         GROUP BY s.id`,
        [workspace.id]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].message_count).toBe(2);
    });

    it('supporte les CTE en lecture', async () => {
      const manager = await service.getManager();
      manager.createWorkspace({ name: 'CTE', path: '/cte' });

      const { rows } = await service.query<{ total: number }>(
        'WITH w AS (SELECT * FROM workspaces) SELECT COUNT(*) as total FROM w'
      );

      expect(rows[0].total).toBe(1);
    });

    it('refuse les écritures', async () => {
      await expect(
        service.query("INSERT INTO workspaces (id, name, path) VALUES ('x', 'y', '/z')")
      ).rejects.toThrow(/Only SELECT statements are allowed/);

      await expect(service.query('UPDATE workspaces SET name = ?', ['hack'])).rejects.toThrow(
        /Only SELECT statements are allowed/
      );

      await expect(service.query('DELETE FROM workspaces')).rejects.toThrow(
        /Only SELECT statements are allowed/
      );
    });

    it('refuse les modifications de schéma', async () => {
      await expect(service.query('DROP TABLE workspaces')).rejects.toThrow(
        /Only SELECT statements are allowed/
      );

      // La table existe toujours
      const { rows } = await service.query('SELECT COUNT(*) as n FROM workspaces');
      expect(rows).toHaveLength(1);
    });

    it('refuse les CTE qui écrivent', async () => {
      await expect(
        service.query("WITH x AS (SELECT 1) DELETE FROM workspaces")
      ).rejects.toThrow(/Only read-only statements are allowed/);
    });

    it('refuse les statements empilés', async () => {
      await expect(service.query('SELECT 1; DROP TABLE workspaces')).rejects.toThrow(
        /Multiple SQL statements are not allowed/
      );
    });

    it('accepte un point-virgule final', async () => {
      const { rows } = await service.query<{ n: number }>('SELECT COUNT(*) as n FROM workspaces;');
      expect(rows).toHaveLength(1);
    });

    it('ne confond pas un ; dans un littéral avec un séparateur', async () => {
      const { rows } = await service.query<{ v: string }>("SELECT 'a;b' as v");
      expect(rows[0].v).toBe('a;b');
    });

    it('remonte une erreur explicite sur table inconnue', async () => {
      await expect(service.query('SELECT * FROM table_inexistante')).rejects.toThrow(
        /no such table/i
      );
    });
  });

  describe('execute', () => {
    it('insère des données et retourne le nombre de changements', async () => {
      const result = await service.execute([
        {
          query: 'INSERT INTO workspaces (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          params: ['ws-1', 'Inséré', '/inserted', Date.now(), Date.now()],
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);

      const { rows } = await service.query<{ name: string }>(
        'SELECT name FROM workspaces WHERE id = ?',
        ['ws-1']
      );
      expect(rows[0].name).toBe('Inséré');
    });

    it('exécute plusieurs statements dans une transaction', async () => {
      const now = Date.now();
      const result = await service.execute([
        {
          query: 'INSERT INTO workspaces (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          params: ['ws-a', 'A', '/a', now, now],
        },
        {
          query: 'INSERT INTO workspaces (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          params: ['ws-b', 'B', '/b', now, now],
        },
      ]);

      expect(result.changes).toBe(2);

      const { rows } = await service.query('SELECT id FROM workspaces');
      expect(rows).toHaveLength(2);
    });

    it('rollback complet si un statement échoue', async () => {
      const now = Date.now();

      await expect(
        service.execute([
          {
            query: 'INSERT INTO workspaces (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            params: ['ws-ok', 'OK', '/ok', now, now],
          },
          {
            // Viole la contrainte NOT NULL sur name
            query: 'INSERT INTO workspaces (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            params: ['ws-bad', null, '/bad', now, now],
          },
        ])
      ).rejects.toThrow();

      // Le premier insert doit avoir été annulé
      const { rows } = await service.query('SELECT id FROM workspaces');
      expect(rows).toHaveLength(0);
    });

    it('met à jour et supprime', async () => {
      const now = Date.now();
      await service.execute([
        {
          query: 'INSERT INTO workspaces (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          params: ['ws-u', 'Avant', '/u', now, now],
        },
      ]);

      const updated = await service.execute([
        { query: 'UPDATE workspaces SET name = ? WHERE id = ?', params: ['Après', 'ws-u'] },
      ]);
      expect(updated.changes).toBe(1);

      const { rows } = await service.query<{ name: string }>(
        'SELECT name FROM workspaces WHERE id = ?',
        ['ws-u']
      );
      expect(rows[0].name).toBe('Après');

      const deleted = await service.execute([
        { query: 'DELETE FROM workspaces WHERE id = ?', params: ['ws-u'] },
      ]);
      expect(deleted.changes).toBe(1);
    });

    it('refuse DROP / ALTER / PRAGMA', async () => {
      for (const query of [
        'DROP TABLE workspaces',
        'ALTER TABLE workspaces ADD COLUMN hack TEXT',
        'PRAGMA journal_mode = DELETE',
        'CREATE TABLE evil (id TEXT)',
        'ATTACH DATABASE ? AS other',
      ]) {
        await expect(service.execute([{ query }])).rejects.toThrow(/is not allowed/);
      }

      // Le schéma est intact
      const { rows } = await service.query("SELECT name FROM sqlite_master WHERE name = 'evil'");
      expect(rows).toHaveLength(0);
    });

    it('refuse un batch vide', async () => {
      await expect(service.execute([])).rejects.toThrow(/At least one statement/);
    });

    it('valide tous les statements avant d\'exécuter quoi que ce soit', async () => {
      const now = Date.now();

      await expect(
        service.execute([
          {
            query: 'INSERT INTO workspaces (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            params: ['ws-first', 'First', '/first', now, now],
          },
          { query: 'DROP TABLE workspaces' },
        ])
      ).rejects.toThrow(/is not allowed/);

      // Rien n'a été inséré : la validation a lieu avant la transaction
      const { rows } = await service.query('SELECT id FROM workspaces');
      expect(rows).toHaveLength(0);
    });
  });

  describe('close', () => {
    it('est idempotent', () => {
      service.close();
      expect(() => service.close()).not.toThrow();
    });

    it('permet une réinitialisation après fermeture', async () => {
      service.close();

      const manager = await service.initialize();
      expect(manager).toBeDefined();

      const { rows } = await service.query('SELECT COUNT(*) as n FROM workspaces');
      expect(rows).toHaveLength(1);
    });
  });
});
