/**
 * IPC Types - Communication type-safe entre main et renderer
 *
 * Agrégat des types par domaine. Les consommateurs importent depuis
 * `@cortex-ide/shared` (ou `@cortex-ide/shared/types/ipc`) sans avoir à
 * connaître le découpage interne.
 */

export * from './base';
export * from './filesystem';
export * from './editor';
export * from './git';
export * from './ai';
export * from './terminal';
export * from './database';
export * from './automation';
export * from './settings';
export * from './channels';
