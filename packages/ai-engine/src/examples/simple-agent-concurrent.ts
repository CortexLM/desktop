/**
 * Example: Concurrent sessions with SimpleAgentManager
 */

import { SimpleAgentManager } from '../simple-agent-manager';
import { AIProviderRegistry } from '../registry';

async function main() {
  const registry = AIProviderRegistry.fromEnv();
  const manager = new SimpleAgentManager(registry);

  console.log('Creating 3 concurrent sessions...\n');

  // Create multiple sessions
  const session1 = await manager.createSession({
    provider: 'openai',
    model: 'gpt-4.5-turbo',
    metadata: { task: 'explain-typescript' },
  });

  const session2 = await manager.createSession({
    provider: 'openai',
    model: 'gpt-4.5-turbo',
    metadata: { task: 'explain-rust' },
  });

  const session3 = await manager.createSession({
    provider: 'openai',
    model: 'gpt-4.5-turbo',
    metadata: { task: 'explain-python' },
  });

  console.log(`✓ Session 1: ${session1.id}`);
  console.log(`✓ Session 2: ${session2.id}`);
  console.log(`✓ Session 3: ${session3.id}\n`);

  // Run all sessions concurrently
  await Promise.all([
    // Session 1: TypeScript
    (async () => {
      console.log('[Session 1] Starting TypeScript task...');
      for await (const chunk of manager.sendMessage(
        session1.id,
        'Explain TypeScript in one sentence'
      )) {
        if (chunk.done) {
          console.log('[Session 1] ✓ Completed');
        }
      }
    })(),

    // Session 2: Rust
    (async () => {
      console.log('[Session 2] Starting Rust task...');
      for await (const chunk of manager.sendMessage(
        session2.id,
        'Explain Rust in one sentence'
      )) {
        if (chunk.done) {
          console.log('[Session 2] ✓ Completed');
        }
      }
    })(),

    // Session 3: Python
    (async () => {
      console.log('[Session 3] Starting Python task...');
      for await (const chunk of manager.sendMessage(
        session3.id,
        'Explain Python in one sentence'
      )) {
        if (chunk.done) {
          console.log('[Session 3] ✓ Completed');
        }
      }
    })(),
  ]);

  // Show statistics
  console.log(`\n✓ Total sessions: ${manager.getSessionCount()}`);
  console.log(`✓ Active sessions: ${manager.getActiveSessionCount()}`);

  // List all sessions
  const allSessions = await manager.listSessions();
  console.log('\nSession details:');
  for (const session of allSessions) {
    console.log(`  - ${session.id}: ${session.messages.length} messages`);
  }

  // Clean up
  await manager.clearAllSessions();
  console.log(`\n✓ All sessions cleared`);
}

main().catch(console.error);
