import { TestRunner, type TestCase } from '../src/index.js';

/**
 * Example: Run a custom test case
 */
async function main() {
  // Define a custom test case
  const testCase: TestCase = {
    id: 'custom-01',
    name: 'TypeScript Best Practices',
    description: 'Test knowledge of TypeScript best practices',
    prompt: 'Explain 5 TypeScript best practices for writing maintainable code. Provide code examples for each.',
    expectedOutputPattern: 'typescript|best practice|maintainable',
    timeout: 45000,
  };
  
  // Configure provider (Grok via OpenLux)
  const apiKey = process.env.OPENLUX_API_KEY;
  if (!apiKey) {
    throw new Error('OPENLUX_API_KEY environment variable is required. Please set it in your .env file.');
  }

  const providerConfig = {
    type: 'grok' as const,
    apiKey,
    baseURL: 'https://api.openlux.ai/v1',
    model: 'claude-opus-5:stable',
    timeout: 60000,
    maxRetries: 3,
  };
  
  // Create test runner
  const runner = new TestRunner({
    debugMode: true,
    onProgress: (progress) => {
      console.log(`[${progress.status}] ${progress.testName} - ${progress.elapsed}ms`);
    },
  });
  
  console.log('🧪 Running custom test...\n');
  
  try {
    const result = await runner.runTest(testCase, providerConfig);
    
    console.log('\n📊 Test Results:');
    console.log(`   Status: ${result.status}`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`   Tokens: ${result.metrics.totalTokens}`);
    console.log(`   Cost: $${result.metrics.totalCost.toFixed(4)}`);
    console.log(`   Latency: ${result.metrics.averageLatency.toFixed(0)}ms`);
    
    if (result.output) {
      console.log('\n📝 Output:');
      console.log(result.output);
    }
    
    if (result.error) {
      console.log('\n❌ Error:', result.error);
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
