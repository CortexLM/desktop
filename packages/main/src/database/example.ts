/**
 * Database usage example
 * Demonstrates how to use the database layer in Cortex IDE
 */

import { DatabaseManager } from './index.js';
import { join } from 'node:path';
import { homedir } from 'node:os';

async function main() {
  console.log('Cortex IDE Database Example');
  console.log('='.repeat(60));

  // Initialize database
  const dbPath = join(homedir(), '.cortex-ide', 'cortex-ide.db');
  console.log('\n📦 Initializing database at:', dbPath);
  
  const db = await DatabaseManager.create(dbPath);
  await db.initialize();
  
  console.log('✓ Database ready\n');

  // Create a workspace
  console.log('1️⃣ Creating workspace...');
  const workspace = db.createWorkspace({
    name: 'Example Project',
    path: join(homedir(), 'projects', 'example'),
    settings: {
      theme: 'dark',
      editor: {
        fontSize: 14,
        tabSize: 2,
        wordWrap: true,
      },
      git: {
        autoFetch: true,
        defaultBranch: 'main',
      },
    },
  });
  console.log(`   ✓ Created workspace: ${workspace.name}`);

  // Create a session
  console.log('\n2️⃣ Creating AI session...');
  const session = db.createSession({
    workspace_id: workspace.id,
    title: 'Build authentication system',
    model: 'gpt-4',
    metadata: {
      provider: 'openai',
      temperature: 0.7,
      maxTokens: 4000,
    },
  });
  console.log(`   ✓ Created session: ${session.title}`);

  // Add messages to session
  console.log('\n3️⃣ Adding messages...');
  const userMsg = db.createMessage({
    session_id: session.id,
    role: 'user',
    content: 'How do I implement JWT authentication in Express.js?',
  });
  console.log(`   ✓ User message: ${userMsg.content.substring(0, 50)}...`);

  const assistantMsg = db.createMessage({
    session_id: session.id,
    role: 'assistant',
    content: 'To implement JWT authentication in Express.js, you need to...',
    metadata: {
      tokens: {
        input: 18,
        output: 245,
      },
    },
  });
  console.log(`   ✓ Assistant message: ${assistantMsg.content.substring(0, 50)}...`);

  // Track usage
  console.log('\n4️⃣ Logging usage...');
  const usageLog = db.createUsageLog({
    session_id: session.id,
    provider: 'openai',
    model: 'gpt-4',
    tokens_input: 18,
    tokens_output: 245,
    cost: 0.0079,
  });
  console.log(`   ✓ Logged usage: $${usageLog.cost?.toFixed(4)}`);

  // Create a mission
  console.log('\n5️⃣ Creating mission...');
  const mission = db.createMission({
    workspace_id: workspace.id,
    status: 'running',
    state: {
      name: 'Implement JWT Authentication',
      description: 'Add JWT-based authentication to the Express API',
      steps: [
        {
          id: 'step-1',
          name: 'Install dependencies (jsonwebtoken, bcrypt)',
          status: 'completed',
          startedAt: Date.now() - 300000,
          completedAt: Date.now() - 240000,
        },
        {
          id: 'step-2',
          name: 'Create auth middleware',
          status: 'running',
          startedAt: Date.now() - 60000,
        },
        {
          id: 'step-3',
          name: 'Add login/register routes',
          status: 'pending',
        },
      ],
      currentStep: 1,
    },
  });
  console.log(`   ✓ Mission started: ${mission.state.name}`);

  // Create an automation
  console.log('\n6️⃣ Creating automation...');
  const automation = db.createAutomation({
    workspace_id: workspace.id,
    name: 'Auto-format TypeScript files',
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
  console.log(`   ✓ Automation created: ${automation.name}`);

  // Query data
  console.log('\n7️⃣ Querying database...');
  const allWorkspaces = db.listWorkspaces();
  const allSessions = db.listSessions(workspace.id);
  const messages = db.listMessages(session.id);
  const missions = db.listMissions(workspace.id, 'running');
  const automations = db.listAutomations(workspace.id, true);
  
  console.log(`   ✓ Workspaces: ${allWorkspaces.length}`);
  console.log(`   ✓ Sessions: ${allSessions.length}`);
  console.log(`   ✓ Messages: ${messages.length}`);
  console.log(`   ✓ Running missions: ${missions.length}`);
  console.log(`   ✓ Enabled automations: ${automations.length}`);

  // Get usage statistics
  console.log('\n8️⃣ Usage statistics...');
  const stats = db.getUsageStats();
  console.log(`   ✓ Total tokens: ${stats.totalTokensInput + stats.totalTokensOutput}`);
  console.log(`   ✓ Total cost: $${stats.totalCost.toFixed(4)}`);
  console.log(`   ✓ Providers: ${Object.keys(stats.byProvider).join(', ')}`);

  // Update mission status
  console.log('\n9️⃣ Updating mission...');
  db.updateMission(mission.id, {
    status: 'running',
    state: {
      ...mission.state,
      currentStep: 2,
      steps: mission.state.steps?.map((step, i) =>
        i === 1
          ? { ...step, status: 'completed' as const, completedAt: Date.now() }
          : i === 2
          ? { ...step, status: 'running' as const, startedAt: Date.now() }
          : step
      ),
    },
  });
  console.log('   ✓ Mission updated to next step');

  // Close database
  console.log('\n🔒 Closing database connection...');
  db.close();
  console.log('   ✓ Database closed');

  console.log('\n' + '='.repeat(60));
  console.log('✓ Example completed successfully!');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
