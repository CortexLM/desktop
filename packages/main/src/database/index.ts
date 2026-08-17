/**
 * Database manager for Cortex IDE
 *
 * Façade au-dessus des repositories par entité. Conserve l'API historique
 * (`createWorkspace`, `listSessions`, ...) tout en déléguant la logique SQL au
 * repository correspondant, accessible directement via `manager.workspaces`,
 * `manager.sessions`, etc.
 */

import { createDatabaseAdapter, type DatabaseAdapter } from './adapter.js';
import { MigrationManager } from './migration-manager.js';
import {
  WorkspaceRepository,
  SessionRepository,
  MessageRepository,
  MissionRepository,
  AutomationRepository,
  UsageLogRepository,
  type UsageStats,
} from './repositories/index.js';
import type {
  Workspace,
  Session,
  Message,
  Mission,
  UsageLog,
  Automation,
} from './types.js';

export class DatabaseManager {
  private db: DatabaseAdapter;
  private migrationManager: MigrationManager;
  private initialized: boolean = false;

  // Repositories, exposés pour un accès direct par entité
  readonly workspaces: WorkspaceRepository;
  readonly sessions: SessionRepository;
  readonly messages: MessageRepository;
  readonly missions: MissionRepository;
  readonly automations: AutomationRepository;
  readonly usageLogs: UsageLogRepository;

  private constructor(db: DatabaseAdapter) {
    this.db = db;

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.migrationManager = new MigrationManager(this.db);

    this.workspaces = new WorkspaceRepository(this.db);
    this.sessions = new SessionRepository(this.db);
    this.messages = new MessageRepository(this.db);
    this.missions = new MissionRepository(this.db);
    this.automations = new AutomationRepository(this.db);
    this.usageLogs = new UsageLogRepository(this.db);
  }

  /**
   * Create a new database manager instance
   */
  static async create(dbPath: string): Promise<DatabaseManager> {
    const db = await createDatabaseAdapter(dbPath);
    return new DatabaseManager(db);
  }

  /**
   * Initialize database and run migrations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.migrationManager.migrate();
    this.initialized = true;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database instance (for advanced operations)
   */
  getDb(): DatabaseAdapter {
    return this.db;
  }

  /**
   * Get migration manager
   */
  getMigrationManager(): MigrationManager {
    return this.migrationManager;
  }

  // ============================================================================
  // WORKSPACE METHODS
  // ============================================================================

  createWorkspace(data: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>): Workspace {
    return this.workspaces.create(data);
  }

  getWorkspace(id: string): Workspace | null {
    return this.workspaces.get(id);
  }

  getWorkspaceByPath(path: string): Workspace | null {
    return this.workspaces.getByPath(path);
  }

  listWorkspaces(): Workspace[] {
    return this.workspaces.list();
  }

  updateWorkspace(id: string, data: Partial<Omit<Workspace, 'id' | 'created_at'>>): void {
    this.workspaces.update(id, data);
  }

  deleteWorkspace(id: string): void {
    this.workspaces.delete(id);
  }

  // ============================================================================
  // SESSION METHODS
  // ============================================================================

  createSession(data: Omit<Session, 'id' | 'created_at' | 'updated_at'>): Session {
    return this.sessions.create(data);
  }

  getSession(id: string): Session | null {
    return this.sessions.get(id);
  }

  listSessions(workspaceId?: string): Session[] {
    return this.sessions.list(workspaceId);
  }

  updateSession(id: string, data: Partial<Omit<Session, 'id' | 'created_at'>>): void {
    this.sessions.update(id, data);
  }

  deleteSession(id: string): void {
    this.sessions.delete(id);
  }

  // ============================================================================
  // MESSAGE METHODS
  // ============================================================================

  createMessage(data: Omit<Message, 'id' | 'created_at'>): Message {
    return this.messages.create(data);
  }

  getMessage(id: string): Message | null {
    return this.messages.get(id);
  }

  listMessages(sessionId: string): Message[] {
    return this.messages.list(sessionId);
  }

  deleteMessage(id: string): void {
    this.messages.delete(id);
  }

  // ============================================================================
  // MISSION METHODS
  // ============================================================================

  createMission(data: Omit<Mission, 'id' | 'created_at' | 'updated_at'>): Mission {
    return this.missions.create(data);
  }

  getMission(id: string): Mission | null {
    return this.missions.get(id);
  }

  listMissions(workspaceId?: string, status?: Mission['status']): Mission[] {
    return this.missions.list(workspaceId, status);
  }

  updateMission(id: string, data: Partial<Omit<Mission, 'id' | 'created_at'>>): void {
    this.missions.update(id, data);
  }

  deleteMission(id: string): void {
    this.missions.delete(id);
  }

  // ============================================================================
  // USAGE LOG METHODS
  // ============================================================================

  createUsageLog(data: Omit<UsageLog, 'id' | 'created_at'>): UsageLog {
    return this.usageLogs.create(data);
  }

  listUsageLogs(sessionId?: string, provider?: string): UsageLog[] {
    return this.usageLogs.list(sessionId, provider);
  }

  getUsageStats(startDate?: number, endDate?: number): UsageStats {
    return this.usageLogs.getStats(startDate, endDate);
  }

  // ============================================================================
  // AUTOMATION METHODS
  // ============================================================================

  createAutomation(data: Omit<Automation, 'id' | 'created_at' | 'updated_at'>): Automation {
    return this.automations.create(data);
  }

  getAutomation(id: string): Automation | null {
    return this.automations.get(id);
  }

  listAutomations(workspaceId?: string, enabledOnly?: boolean): Automation[] {
    return this.automations.list(workspaceId, enabledOnly);
  }

  updateAutomation(id: string, data: Partial<Omit<Automation, 'id' | 'created_at'>>): void {
    this.automations.update(id, data);
  }

  deleteAutomation(id: string): void {
    this.automations.delete(id);
  }
}

// ============================================================================
// Ré-exports
// ============================================================================

export * from './repositories/index.js';
