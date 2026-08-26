/**
 * Secrets Service — les variables d'environnement que les exécutions reçoivent.
 *
 * ---------------------------------------------------------------------------
 * La valeur ne remonte jamais
 * ---------------------------------------------------------------------------
 * Même asymétrie que pour les clés de providers, et pour la même raison : le
 * renderer est le process le moins fiable. Un secret lisible depuis lui est
 * lisible par tout ce qui s'y exécute.
 *
 *   renderer -> main : le nom et la valeur, UNE fois, à la création.
 *   main -> renderer : le nom, la portée, la dernière utilisation. Jamais la valeur.
 *
 * `SecretView` n'a donc pas de champ valeur, et pas même de masque : contrairement
 * à une clé d'API, où `sk-…4242` aide à reconnaître *laquelle* est enregistrée, un
 * secret est identifié par son nom — le masque n'apporterait rien et donnerait
 * quatre caractères.
 *
 * ---------------------------------------------------------------------------
 * Portée
 * ---------------------------------------------------------------------------
 * `local` uniquement pour l'instant. `account` demande une API de synchronisation
 * côté Cortex que le service n'expose pas (`/auth/api-keys` gère les clés d'API,
 * pas les secrets d'exécution), et écrire « synced » sur quelque chose qui reste
 * sur le disque serait un mensonge affiché.
 */

import { safeStorage } from 'electron';

import type { SecretView } from '@cortex-ide/shared';

import { getDatabaseService } from './database-service';

// `SecretView` vit dans `@cortex-ide/shared` : c'est un contrat IPC, et le
// renderer en a besoin autant que main.

interface SecretRow {
  id: string;
  name: string;
  value: string | null;
  value_enc: string | null;
  scope: string;
  created_at: number;
  last_used_at: number | null;
}

/** Nommage de variable d'environnement : majuscules, chiffres, tirets bas. */
const NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

export class SecretsService {
  /**
   * `safeStorage` est-il utilisable ?
   *
   * Testé par `typeof`, comme pour les clés de providers : un Linux sans keyring
   * renvoie légitimement `false`, et « pas de chiffrement » ne doit pas se
   * confondre avec « plantage ».
   */
  isEncryptionAvailable(): boolean {
    try {
      return (
        typeof safeStorage?.isEncryptionAvailable === 'function' &&
        safeStorage.isEncryptionAvailable()
      );
    } catch {
      return false;
    }
  }

  async list(): Promise<SecretView[]> {
    const db = getDatabaseService();
    const result = await db.query<SecretRow>(
      'SELECT id, name, scope, created_at, last_used_at FROM secrets ORDER BY name ASC',
    );

    return result.rows.map((row) => {
      const view: SecretView = {
        id: row.id,
        name: row.name,
        scope: row.scope === 'account' ? 'account' : 'local',
      };
      if (row.last_used_at !== null) view.lastUsedAt = row.last_used_at;
      return view;
    });
  }

  /**
   * Crée ou remplace un secret.
   *
   * Remplace plutôt qu'échoue sur un nom existant : deux secrets de même nom ne
   * peuvent pas coexister — la variable d'environnement n'aurait qu'une valeur —
   * et « ce nom est pris » obligerait l'utilisateur à supprimer puis recréer pour
   * faire une chose que l'UI peut faire pour lui.
   */
  async create(name: string, value: string): Promise<SecretView> {
    const trimmed = name.trim();
    if (!NAME_PATTERN.test(trimmed)) {
      throw new Error(
        `"${trimmed}" is not a valid environment variable name. Use A-Z, 0-9 and underscores.`,
      );
    }
    if (value.length === 0) throw new Error('A secret needs a value');

    const now = Date.now();
    const stored = this.isEncryptionAvailable()
      ? { value: null, value_enc: safeStorage.encryptString(value).toString('base64') }
      : { value, value_enc: null };

    const db = getDatabaseService();
    await db.execute([
      {
        query: `INSERT INTO secrets (id, name, value, value_enc, scope, created_at)
                VALUES (?, ?, ?, ?, 'local', ?)
                ON CONFLICT(name) DO UPDATE SET
                  value = excluded.value,
                  value_enc = excluded.value_enc`,
        params: [`secret_${now}_${Math.random().toString(36).slice(2, 9)}`, trimmed, stored.value, stored.value_enc, now],
      },
    ]);

    const all = await this.list();
    const created = all.find((secret) => secret.name === trimmed);
    if (!created) throw new Error('The secret was not stored');
    return created;
  }

  async remove(id: string): Promise<void> {
    const db = getDatabaseService();
    await db.execute([{ query: 'DELETE FROM secrets WHERE id = ?', params: [id] }]);
  }

  /**
   * The secrets an agent run should receive as environment variables.
   *
   * Main-process only, and not reachable over IPC — this is the one method that
   * returns values, and its whole point is that the renderer cannot call it.
   *
   * Marks each returned secret as used, so the list can say when one last mattered
   * rather than only when it was created.
   */
  async environment(): Promise<Record<string, string>> {
    const db = getDatabaseService();
    const result = await db.query<SecretRow>('SELECT * FROM secrets');

    const environment: Record<string, string> = {};
    const used: string[] = [];

    for (const row of result.rows) {
      const value = this.decrypt(row);
      if (value === undefined) continue;
      environment[row.name] = value;
      used.push(row.id);
    }

    if (used.length > 0) {
      const now = Date.now();
      await db.execute(
        used.map((id) => ({
          query: 'UPDATE secrets SET last_used_at = ? WHERE id = ?',
          params: [now, id],
        })),
      );
    }

    return environment;
  }

  private decrypt(row: SecretRow): string | undefined {
    if (row.value_enc !== null) {
      try {
        return safeStorage.decryptString(Buffer.from(row.value_enc, 'base64'));
      } catch (error) {
        // The keyring changed (another machine, a recreated session). The secret is
        // unrecoverable, which means the run goes without it rather than failing to
        // start — and the row stays so the user can see it needs re-entering.
        console.error(
          '[Secrets] Stored secret could not be decrypted:',
          error instanceof Error ? error.name : typeof error,
        );
        return undefined;
      }
    }
    return row.value ?? undefined;
  }
}

let instance: SecretsService | null = null;

export function getSecretsService(): SecretsService {
  if (!instance) instance = new SecretsService();
  return instance;
}

export function resetSecretsService(): void {
  instance = null;
}
