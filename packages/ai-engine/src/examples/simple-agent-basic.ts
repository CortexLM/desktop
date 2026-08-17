/**
 * Example: Basic usage of SimpleAgentManager
 */

import { SimpleAgentManager } from '../simple-agent-manager';
import { AIProviderRegistry } from '../registry';

async function main() {
  // Initialize provider registry from environment
  const registry = AIProviderRegistry.fromEnv();

  // Create manager
  const manager = new SimpleAgentManager(registry);

  // Create a session
  const session = await manager.createSession({
    provider: 'openai',
    model: 'gpt-4.5-turbo',
    temperature: 0.7,
    systemPrompt: 'You are a helpful coding assistant.',
    metadata: {
      userId: 'demo-user',
      feature: 'code-help',
    },
  });

  console.log(`✓ Session created: ${session.id}\n`);

  // Send first message
  console.log('User: Explain what a TypeScript interface is\n');
  console.log('Assistant: ');

  for await (const chunk of manager.sendMessage(
    session.id,
    'Explain what a TypeScript interface is'
  )) {
    process.stdout.write(chunk.content);
  }

  console.log('\n');

  // Send follow-up message
  console.log('User: Can you show me an example?\n');
  console.log('Assistant: ');

  for await (const chunk of manager.sendMessage(
    session.id,
    'Can you show me an example?'
  )) {
    process.stdout.write(chunk.content);
  }

  console.log('\n');

  // Show conversation history
  const updatedSession = manager.getSession(session.id);
  console.log(`\n✓ Conversation has ${updatedSession?.messages.length} messages`);
  console.log(`✓ Session status: ${updatedSession?.status}`);

  // Clean up
  await manager.deleteSession(session.id);
  console.log(`\n✓ Session deleted`);
}

main().catch(console.error);
