/**
 * Base commune aux repositories.
 *
 * Centralise ce que toutes les entités partagent : accès à l'adapter, et
 * construction des `UPDATE` partiels (la duplication la plus coûteuse de
 * l'ancien `DatabaseManager`).
 */

import type { DatabaseAdapter, SqlValue } from '../adapter.js';

/**
 * Colonne à mettre à jour, avec sa valeur déjà sérialisée pour SQLite
 */
export interface ColumnUpdate {
  column: string;
  /** Déjà sérialisée : SQLite ne lie que des scalaires (cf. `SqlValue`). */
  value: SqlValue;
}

export abstract class BaseRepository {
  constructor(protected readonly db: DatabaseAdapter) {}

  /**
   * Applique un `UPDATE` partiel sur une table possédant `id` et `updated_at`.
   *
   * `updated_at` est toujours rafraîchi, même sans colonne à modifier : un
   * `update(id, {})` sert à marquer la ligne comme touchée.
   *
   * @returns le nombre de lignes modifiées
   */
  protected applyUpdate(table: string, id: string, updates: ColumnUpdate[]): number {
    const assignments = [...updates.map((u) => `${u.column} = ?`), 'updated_at = ?'];
    const values = [...updates.map((u) => u.value), Date.now(), id];

    const result = this.db
      .prepare(`UPDATE ${table} SET ${assignments.join(', ')} WHERE id = ?`)
      .run(...values);

    return result.changes;
  }

  /**
   * Supprime une ligne par son id
   *
   * @returns le nombre de lignes supprimées
   */
  protected deleteById(table: string, id: string): number {
    return this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes;
  }

  /**
   * Collecte les colonnes à mettre à jour parmi les champs fournis.
   *
   * Seuls les champs `!== undefined` sont retenus, ce qui permet de distinguer
   * « ne pas toucher » (absent) de « mettre à null » (explicitement fourni).
   */
  protected collectUpdates<TData extends object>(
    data: TData,
    mappers: {
      [K in keyof TData]?: {
        column: string;
        /** Doit produire un scalaire liable par SQLite. */
        serialize?: (value: NonNullable<TData[K]>) => SqlValue;
      };
    }
  ): ColumnUpdate[] {
    const updates: ColumnUpdate[] = [];

    for (const key of Object.keys(mappers) as Array<keyof TData>) {
      const value = data[key];
      if (value === undefined) continue;

      const mapper = mappers[key];
      if (!mapper) continue;

      updates.push({
        column: mapper.column,
        value: mapper.serialize
          ? mapper.serialize(value as NonNullable<TData[keyof TData]>)
          : // Sans `serialize`, la colonne est censée être déjà scalaire ; les
            // champs structurés passent tous par un serialize explicite.
            (value as SqlValue),
      });
    }

    return updates;
  }
}

/**
 * Sérialise une valeur en JSON, en préservant `null` pour les champs absents
 */
export function toJSONColumn(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

/**
 * Parse une colonne JSON nullable
 */
export function fromJSONColumn<T>(value: string | null | undefined): T | undefined {
  return value ? (JSON.parse(value) as T) : undefined;
}
