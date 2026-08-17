/**
 * Example: Integration with AIService
 * Demonstrates how to use SimpleAgentManager with the existing AI provider system
 */

import { SimpleAgentManager } from '../simple-agent-manager';
import { AIProviderRegistry } from '../registry';
import {
  AIProvider,
  type Message,
  type ChatOptions,
  type ChatResponse,
  type StreamChunk,
} from '../providers/base';

// Mock simple provider for demo.
//
// `extends`, not `implements`: AIProvider is an abstract class with a protected
// `config` and a protected `handleError`, which `implements` cannot satisfy —
// so the class was never assignable to `AIProvider` and `registry.register()`
// rejected it.
class DemoProvider extends AIProvider {
  readonly id = 'demo';
  readonly name = 'Demo Provider';

  async chat(_messages: Message[], _options?: ChatOptions): Promise<ChatResponse> {
    return {
      content: 'Demo response',
      model: 'demo-model',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      finishReason: 'stop',
    };
  }

  async *stream(
    _messages: Message[],
    _options?: ChatOptions
  ): AsyncIterableIterator<StreamChunk> {
    const words = 'This is a demo streaming response'.split(' ');
    for (const word of words) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield { content: word + ' ', done: false };
    }
    yield { content: '', done: true };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

async function demonstrateIntegration() {
  console.log('=== SimpleAgentManager Integration Demo ===\n');

  // 1. Setup registry with providers
  console.log('1. Setting up provider registry...');
  const registry = new AIProviderRegistry();
  registry.register(new DemoProvider());
  registry.setDefault('demo');
  console.log('✓ Registry configured\n');

  // 2. Create manager
  console.log('2. Creating SimpleAgentManager...');
  const manager = new SimpleAgentManager(registry);
  console.log('✓ Manager created\n');

  // 3. Create multiple sessions
  console.log('3. Creating agent sessions...');
  const session1 = await manager.createSession({
    provider: 'demo',
    model: 'demo-model',
    systemPrompt: 'You are a code reviewer.',
    metadata: { feature: 'code-review', userId: 'user-1' },
  });

  const session2 = await manager.createSession({
    provider: 'demo',
    model: 'demo-model',
    systemPrompt: 'You are a documentation assistant.',
    metadata: { feature: 'docs', userId: 'user-2' },
  });

  console.log(`✓ Session 1: ${session1.id}`);
  console.log(`✓ Session 2: ${session2.id}\n`);

  // 4. Concurrent streaming
  console.log('4. Running concurrent conversations...\n');

  await Promise.all([
    (async () => {
      console.log('[Session 1] Streaming response...');
      for await (const chunk of manager.sendMessage(
        session1.id,
        'Review this code'
      )) {
        process.stdout.write(chunk.content);
      }
      console.log('\n[Session 1] ✓ Complete\n');
    })(),

    (async () => {
      console.log('[Session 2] Streaming response...');
      for await (const chunk of manager.sendMessage(
        session2.id,
        'Generate docs'
      )) {
        process.stdout.write(chunk.content);
      }
      console.log('\n[Session 2] ✓ Complete\n');
    })(),
  ]);

  // 5. Session management
  console.log('5. Managing sessions...');
  
  // Pause session 1
  await manager.pauseSession(session1.id);
  console.log(`✓ Session 1 paused`);

  // List all sessions
  const allSessions = await manager.listSessions();
  console.log(`✓ Total sessions: ${allSessions.length}`);
  
  const activeSessions = await manager.listSessions('active');
  console.log(`✓ Active sessions: ${activeSessions.length}`);

  const pausedSessions = await manager.listSessions('paused');
  console.log(`✓ Paused sessions: ${pausedSessions.length}\n`);

  // 6. Resume and continue
  console.log('6. Resuming paused session...');
  await manager.resumeSession(session1.id);
  console.log('✓ Session 1 resumed');

  for await (const chunk of manager.sendMessage(
    session1.id,
    'Continue review'
  )) {
    process.stdout.write(chunk.content);
  }
  console.log('\n✓ Conversation continued\n');

  // 7. Statistics
  console.log('7. Manager statistics:');
  console.log(`   Total sessions: ${manager.getSessionCount()}`);
  console.log(`   Active sessions: ${manager.getActiveSessionCount()}`);

  const s1 = manager.getSession(session1.id);
  console.log(`   Session 1 messages: ${s1?.messages.length}`);
  
  const s2 = manager.getSession(session2.id);
  console.log(`   Session 2 messages: ${s2?.messages.length}\n`);

  // 8. Cleanup
  console.log('8. Cleaning up...');
  await manager.clearAllSessions();
  console.log(`✓ All sessions cleared`);
  console.log(`✓ Final session count: ${manager.getSessionCount()}\n`);

  console.log('=== Demo Complete ===');
}

// Run demo
demonstrateIntegration().catch((error) => {
  console.error('Demo failed:', error);
  process.exit(1);
});
