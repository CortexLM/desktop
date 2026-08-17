#!/usr/bin/env bun
/**
 * Database Performance Profiler
 * Analyzes SQLite query performance and identifies N+1 queries
 */

import { Database } from 'better-sqlite3';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

interface QueryProfile {
  sql: string;
  executionTime: number;
  rowsAffected: number;
  isPrepared: boolean;
}

interface DatabaseProfile {
  timestamp: string;
  dbPath: string;
  dbSize: number;
  queries: QueryProfile[];
  slowQueries: QueryProfile[];
  statistics: {
    totalQueries: number;
    avgQueryTime: number;
    maxQueryTime: number;
    totalTime: number;
  };
  indexes: {
    table: string;
    indexName: string;
    columns: string;
  }[];
  recommendations: any[];
}

async function profileDatabase() {
  console.log('🗄️  Profiling database performance...\n');

  // Try to find the database
  const possiblePaths = [
    join(process.cwd(), 'cortex-ide.db'),
    join(homedir(), 'Library', 'Application Support', 'cortex-ide', 'cortex-ide.db'),
    join(homedir(), '.config', 'cortex-ide', 'cortex-ide.db')
  ];

  let dbPath: string | null = null;
  let db: Database | null = null;

  for (const path of possiblePaths) {
    try {
      const testDb = new (await import('better-sqlite3')).default(path, { readonly: true });
      testDb.close();
      dbPath = path;
      console.log(`✓ Found database at: ${path}`);
      break;
    } catch (error) {
      // Try next path
    }
  }

  if (!dbPath) {
    console.log('❌ Database not found. Creating sample analysis...');
    await createSampleAnalysis();
    return;
  }

  try {
    db = new (await import('better-sqlite3')).default(dbPath, { readonly: true });

    // Get database size
    const stat = await import('fs/promises').then(fs => fs.stat(dbPath!));
    const dbSize = stat.size;

    // Profile common queries
    const queries: QueryProfile[] = [];

    const testQueries = [
      'SELECT COUNT(*) FROM ai_sessions',
      'SELECT * FROM ai_sessions ORDER BY created_at DESC LIMIT 10',
      'SELECT * FROM ai_messages WHERE session_id = (SELECT id FROM ai_sessions LIMIT 1) ORDER BY created_at',
      'SELECT * FROM automations WHERE enabled = 1',
      'SELECT * FROM mcp_servers WHERE enabled = 1',
      'SELECT COUNT(*) FROM automation_executions'
    ];

    for (const sql of testQueries) {
      try {
        const start = performance.now();
        const result = db.prepare(sql).all();
        const duration = performance.now() - start;

        queries.push({
          sql,
          executionTime: duration,
          rowsAffected: Array.isArray(result) ? result.length : 0,
          isPrepared: true
        });

        console.log(`✓ ${sql.substring(0, 50)}... (${duration.toFixed(2)}ms)`);
      } catch (error) {
        console.warn(`⚠️  Query failed: ${sql}`);
      }
    }

    // Get all indexes
    const indexes = db.prepare(`
      SELECT 
        m.name as table_name,
        il.name as index_name,
        GROUP_CONCAT(ii.name) as columns
      FROM sqlite_master m,
           pragma_index_list(m.name) il,
           pragma_index_info(il.name) ii
      WHERE m.type = 'table'
      GROUP BY m.name, il.name
    `).all() as any[];

    // Get table statistics
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as any[];

    console.log('\n📊 Database Statistics:');
    console.log(`   Size: ${formatBytes(dbSize)}`);
    console.log(`   Tables: ${tables.length}`);
    console.log(`   Indexes: ${indexes.length}`);

    // Calculate statistics
    const totalQueries = queries.length;
    const totalTime = queries.reduce((sum, q) => sum + q.executionTime, 0);
    const avgQueryTime = totalTime / totalQueries;
    const maxQueryTime = Math.max(...queries.map(q => q.executionTime));
    const slowQueries = queries.filter(q => q.executionTime > 10);

    const profile: DatabaseProfile = {
      timestamp: new Date().toISOString(),
      dbPath,
      dbSize,
      queries,
      slowQueries,
      statistics: {
        totalQueries,
        avgQueryTime,
        maxQueryTime,
        totalTime
      },
      indexes: indexes.map(idx => ({
        table: idx.table_name,
        indexName: idx.index_name,
        columns: idx.columns
      })),
      recommendations: generateDatabaseRecommendations(queries, indexes, tables)
    };

    // Save report
    const outputDir = join(process.cwd(), 'performance-reports');
    await mkdir(outputDir, { recursive: true });
    const reportPath = join(outputDir, `database-profile-${Date.now()}.json`);
    await writeFile(reportPath, JSON.stringify(profile, null, 2));

    console.log(`\n📁 Report saved to: ${reportPath}`);
    
    if (slowQueries.length > 0) {
      console.log(`\n⚠️  ${slowQueries.length} slow queries detected (>10ms)`);
      slowQueries.forEach(q => {
        console.log(`   ${q.sql.substring(0, 60)}... (${q.executionTime.toFixed(2)}ms)`);
      });
    }

    db.close();
    return profile;

  } catch (error) {
    console.error('❌ Database profiling failed:', error);
    if (db) db.close();
  }
}

async function createSampleAnalysis() {
  const sample: DatabaseProfile = {
    timestamp: new Date().toISOString(),
    dbPath: 'not-found',
    dbSize: 0,
    queries: [],
    slowQueries: [],
    statistics: {
      totalQueries: 0,
      avgQueryTime: 0,
      maxQueryTime: 0,
      totalTime: 0
    },
    indexes: [],
    recommendations: [
      {
        severity: 'info',
        area: 'Database',
        issue: 'Database not found',
        suggestion: 'Run the app first to create the database, then run this profiler'
      }
    ]
  };

  const outputDir = join(process.cwd(), 'performance-reports');
  await mkdir(outputDir, { recursive: true });
  const reportPath = join(outputDir, 'database-profile-sample.json');
  await writeFile(reportPath, JSON.stringify(sample, null, 2));
  
  console.log(`📁 Sample report saved to: ${reportPath}`);
}

function generateDatabaseRecommendations(queries: QueryProfile[], indexes: any[], tables: any[]) {
  const recommendations = [];

  // Check for missing indexes on common queries
  const selectQueries = queries.filter(q => q.sql.includes('WHERE'));
  if (selectQueries.length > 0) {
    recommendations.push({
      severity: 'medium',
      area: 'Indexes',
      issue: 'Review WHERE clauses for missing indexes',
      suggestion: 'Add indexes on frequently queried columns'
    });
  }

  // Check for slow queries
  const slowQueries = queries.filter(q => q.executionTime > 10);
  if (slowQueries.length > 0) {
    recommendations.push({
      severity: 'high',
      area: 'Query Performance',
      issue: `${slowQueries.length} queries exceed 10ms`,
      suggestion: 'Optimize slow queries with indexes or query restructuring'
    });
  }

  // Check for SELECT *
  const selectAllQueries = queries.filter(q => q.sql.includes('SELECT *'));
  if (selectAllQueries.length > 0) {
    recommendations.push({
      severity: 'low',
      area: 'Query Optimization',
      issue: `${selectAllQueries.length} queries use SELECT *`,
      suggestion: 'Select only needed columns to reduce data transfer'
    });
  }

  return recommendations;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

profileDatabase().catch(console.error);
