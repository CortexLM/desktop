import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { safeStorageMock } from '../../../../../test/electron-mock';

const { dbHolder } = vi.hoisted(() => ({
  dbHolder: { current: null as import('../database-service').DatabaseService | null },
}));

vi.mock('../database-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../database-service')>();
  return {
    ...actual,
    getDatabaseService: () => {
      if (!dbHolder.current) throw new Error('database not ready');
      return dbHolder.current;
    },
  };
});

const { DatabaseService } = await import('../database-service');
const { SecretsService, getSecretsService, resetSecretsService } = await import('../secrets-service');

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cortex-secrets-'));
  const db = new DatabaseService(join(dir, 'test.db'));
  await db.initialize();
  dbHolder.current = db;
  safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
});

afterEach(async () => {
  dbHolder.current?.close();
  dbHolder.current = null;
  resetSecretsService();
  await rm(dir, { recursive: true, force: true });
});

describe('SecretsService', () => {
  it('stores an encrypted secret and never returns the value', async () => {
    const service = new SecretsService();
    const created = await service.create('STRIPE_KEY', 'sk_test_secret');
    expect(created.name).toBe('STRIPE_KEY');
    expect(created).not.toHaveProperty('value');
    const listed = await service.list();
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain('sk_test_secret');
    const env = await service.environment();
    expect(env.STRIPE_KEY).toBe('sk_test_secret');
    expect((await service.list())[0]?.lastUsedAt).toBeTypeOf('number');
  });

  it('rejects a bad name or empty value', async () => {
    const service = new SecretsService();
    await expect(service.create('bad-name', 'x')).rejects.toThrow(/valid environment variable/);
    await expect(service.create('OK', '')).rejects.toThrow(/needs a value/);
  });

  it('replaces a secret of the same name and can remove it', async () => {
    const service = new SecretsService();
    await service.create('TOKEN', 'one');
    await service.create('TOKEN', 'two');
    expect((await service.list()).map((row) => row.name)).toEqual(['TOKEN']);
    expect((await service.environment()).TOKEN).toBe('two');
    const id = (await service.list())[0]!.id;
    await service.remove(id);
    expect(await service.list()).toEqual([]);
  });

  it('stores plaintext when encryption is unavailable', async () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);
    const service = new SecretsService();
    await service.create('PLAIN', 'visible');
    expect((await service.environment()).PLAIN).toBe('visible');
  });

  it('skips a secret that cannot be decrypted', async () => {
    const service = new SecretsService();
    await service.create('BROKEN', 'value');
    safeStorageMock.decryptString.mockImplementationOnce(() => {
      throw new Error('keyring changed');
    });
    await expect(service.environment()).resolves.toEqual({});
  });

  it('reports encryption unavailable when the check throws', () => {
    safeStorageMock.isEncryptionAvailable.mockImplementation(() => {
      throw new Error('no keyring');
    });
    expect(new SecretsService().isEncryptionAvailable()).toBe(false);
  });

  it('reuses a singleton until reset', () => {
    const first = getSecretsService();
    expect(getSecretsService()).toBe(first);
    resetSecretsService();
    expect(getSecretsService()).not.toBe(first);
  });
});
