import { createProvider } from '../src/index.js';

/**
 * Example: Test Grok provider with OpenLux API
 */
async function main() {
  const apiKey = process.env.OPENLUX_API_KEY;
  if (!apiKey) {
    throw new Error('OPENLUX_API_KEY environment variable is required. Please set it in your .env file.');
  }

  const provider = createProvider({
    type: 'grok',
    apiKey,
    baseURL: 'https://api.openlux.ai/v1',
    model: 'claude-opus-5:stable',
    timeout: 60000,
    maxRetries: 3,
  });
  
  console.log(`🤖 Testing provider: ${provider.name} (${provider.model})\n`);
  
  const messages = [
    {
      role: 'user' as const,
      content: 'Write a simple Hello World function in TypeScript with JSDoc comments.',
      timestamp: Date.now(),
    },
  ];
  
  try {
    console.log('📤 Sending request...');
    const startTime = Date.now();
    
    const response = await provider.chat(messages);
    
    const duration = Date.now() - startTime;
    
    console.log('\n✅ Response received!');
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Tokens: ${response.tokensUsed.total} (${response.tokensUsed.prompt} prompt + ${response.tokensUsed.completion} completion)`);
    console.log(`   Cost: $${response.cost?.toFixed(4) ?? '0.0000'}`);
    console.log(`   Finish reason: ${response.finishReason}`);
    
    console.log('\n📝 Content:');
    console.log(response.content);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
