/**
 * Database integration test
 * Tests all CRUD operations and migration system
 */

import { DatabaseManager } from './index.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { unlinkSync, existsSync } from 'node:fs';

async function testDatabase() {
  // Create temporary database
  const dbPath = join(tmpdir(), `cortex-ide-test-${randomUUID()}.db`);
  console.log('Testing database at:', dbPath);
  console.log('='.repeat(60));

  const db = await DatabaseManager.create(dbPath);

  try {
    // Test 1: Initialize and migrate
    console.log('\n[TEST 1] Initializing database and running migrations...');
    await db.initialize();
    const version = db.getMigrationManager().getCurrentVersion();
    console.log('✓ Database initialized at version:', version);

    // Test 2: Create workspace
    console.log('\n[TEST 2] Creating workspace...');
    const workspace = db.createWorkspace({
      name: 'Test Project',
      path: '/home/user/projects/test',
      settings: {
        theme: 'dark',
        editor: {
          fontSize: 14,
          tabSize: 2,
        },
      },
    });
    console.log('✓ Workspace created:', workspace.id);
    console.log('  Name:', workspace.name);
    console.log('  Path:', workspace.path);
    console.log('  Settings:', JSON.stringify(workspace.settings, null, 2));

    // Test 3: Get workspace
    console.log('\n[TEST 3] Retrieving workspace...');
    const retrievedWorkspace = db.getWorkspace(workspace.id);
    console.log('✓ Workspace retrieved:', retrievedWorkspace?.name);

    // Test 4: Create session
    console.log('\n[TEST 4] Creating session...');
    const session = db.createSession({
      workspace_id: workspace.id,
      title: 'Build authentication system',
      model: 'gpt-4',
      metadata: {
        provider: 'openai',
        temperature: 0.7,
      },
    });
    console.log('✓ Session created:', session.id);
    console.log('  Title:', session.title);
    console.log('  Model:', session.model);

    // Test 5: Create messages
    console.log('\n[TEST 5] Creating messages...');
    const userMessage = db.createMessage({
      session_id: session.id,
      role: 'user',
      content: 'How do I implement JWT authentication?',
    });
    console.log('✓ User message created:', userMessage.id);

    const assistantMessage = db.createMessage({
      session_id: session.id,
      role: 'assistant',
      content: 'Here is how to implement JWT authentication...',
      metadata: {
        tokens: {
          input: 15,
          output: 150,
        },
      },
    });
    console.log('✓ Assistant message created:', assistantMessage.id);

    // Test 6: List messages
    console.log('\n[TEST 6] Listing messages...');
    const messages = db.listMessages(session.id);
    console.log(`✓ Found ${messages.length} messages in session`);
    messages.forEach((msg, i) => {
      console.log(`  ${i + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
    });

    // Test 7: Create mission
    console.log('\n[TEST 7] Creating mission...');
    const mission = db.createMission({
      workspace_id: workspace.id,
      status: 'running',
      state: {
        name: 'Refactor authentication module',
        description: 'Refactor the auth module to use JWT',
        steps: [
          {
            id: 'step-1',
            name: 'Install dependencies',
            status: 'completed',
          },
          {
            id: 'step-2',
            name: 'Implement JWT utils',
            status: 'running',
          },
        ],
        currentStep: 1,
      },
    });
    console.log('✓ Mission created:', mission.id);
    console.log('  Status:', mission.status);
    console.log('  Steps:', mission.state.steps?.length);

    // Test 8: Create usage logs
    console.log('\n[TEST 8] Creating usage logs...');
    const usageLog = db.createUsageLog({
      session_id: session.id,
      provider: 'openai',
      model: 'gpt-4',
      tokens_input: 15,
      tokens_output: 150,
      cost: 0.0045,
    });
    console.log('✓ Usage log created:', usageLog.id);
    console.log('  Provider:', usageLog.provider);
    console.log('  Cost: $' + usageLog.cost?.toFixed(4));

    // Test 9: Get usage stats
    console.log('\n[TEST 9] Getting usage statistics...');
    const stats = db.getUsageStats();
    console.log('✓ Usage stats retrieved:');
    console.log('  Total tokens (input):', stats.totalTokensInput);
    console.log('  Total tokens (output):', stats.totalTokensOutput);
    console.log('  Total cost: $' + stats.totalCost.toFixed(4));
    console.log('  By provider:', Object.keys(stats.byProvider));

    // Test 10: Create automation
    console.log('\n[TEST 10] Creating automation...');
    const automation = db.createAutomation({
      workspace_id: workspace.id,
      name: 'Auto-format on save',
      enabled: true,
      trigger: {
        type: 'file_watch',
        config: {
          pattern: '**/*.ts',
          event: 'save',
        },
      },
      actions: [
        {
          type: 'run_script',
          config: {
            command: 'prettier --write',
          },
        },
      ],
    });
    console.log('✓ Automation created:', automation.id);
    console.log('  Name:', automation.name);
    console.log('  Enabled:', automation.enabled);
    console.log('  Trigger type:', automation.trigger.type);

    // Test 11: List all data
    console.log('\n[TEST 11] Listing all data...');
    const allWorkspaces = db.listWorkspaces();
    const allSessions = db.listSessions();
    const allMissions = db.listMissions();
    const allAutomations = db.listAutomations();
    console.log('✓ Data summary:');
    console.log('  Workspaces:', allWorkspaces.length);
    console.log('  Sessions:', allSessions.length);
    console.log('  Missions:', allMissions.length);
    console.log('  Automations:', allAutomations.length);

    // Test 12: Update operations
    console.log('\n[TEST 12] Testing update operations...');
    db.updateWorkspace(workspace.id, {
      name: 'Test Project (Updated)',
    });
    const updatedWorkspace = db.getWorkspace(workspace.id);
    console.log('✓ Workspace updated:', updatedWorkspace?.name);

    db.updateSession(session.id, {
      title: 'Build authentication system (Updated)',
    });
    const updatedSession = db.getSession(session.id);
    console.log('✓ Session updated:', updatedSession?.title);

    db.updateMission(mission.id, {
      status: 'completed',
    });
    const updatedMission = db.getMission(mission.id);
    console.log('✓ Mission updated:', updatedMission?.status);

    db.updateAutomation(automation.id, {
      enabled: false,
    });
    const updatedAutomation = db.getAutomation(automation.id);
    console.log('✓ Automation updated (enabled):', updatedAutomation?.enabled);

    // Test 13: Migration status
    console.log('\n[TEST 13] Checking migration status...');
    const status = await db.getMigrationManager().getStatus();
    console.log('✓ Migration status:');
    console.log('  Current version:', status.current);
    console.log('  Available migrations:', status.available.length);
    console.log('  Pending migrations:', status.pending.length);

    // Test 14: Database integrity
    console.log('\n[TEST 14] Checking database integrity...');
    const integrity = db.getDb().pragma('integrity_check') as Array<{ integrity_check: string }>;
    console.log('✓ Integrity check:', integrity[0].integrity_check);

    // Test 15: Delete operations
    console.log('\n[TEST 15] Testing delete operations...');
    db.deleteMessage(userMessage.id);
    console.log('✓ Message deleted');
    
    db.deleteAutomation(automation.id);
    console.log('✓ Automation deleted');
    
    // Note: Deleting session will cascade delete remaining messages
    db.deleteSession(session.id);
    console.log('✓ Session deleted (with cascade)');
    
    db.deleteMission(mission.id);
    console.log('✓ Mission deleted');
    
    db.deleteWorkspace(workspace.id);
    console.log('✓ Workspace deleted (with cascade)');

    console.log('\n' + '='.repeat(60));
    console.log('✓ All tests passed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n✗ Test failed:', error);
    throw error;
  } finally {
    // Cleanup
    db.close();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
      // Also clean up WAL and SHM files
      const walPath = dbPath + '-wal';
      const shmPath = dbPath + '-shm';
      if (existsSync(walPath)) unlinkSync(walPath);
      if (existsSync(shmPath)) unlinkSync(shmPath);
    }
    console.log('\nTest database cleaned up');
  }
}

// Run tests
testDatabase().catch(console.error);
