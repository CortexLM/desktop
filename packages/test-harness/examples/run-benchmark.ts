import { BenchmarkSuite, createProvider } from '../src/index.js';

/**
 * Example: Run a complete benchmark suite with all providers
 */
async function main() {
  // Configure providers
  const providers = [];
  
  // OpenAI
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      type: 'openai' as const,
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4',
      timeout: 60000,
      maxRetries: 3,
    });
  }
  
  // Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      type: 'anthropic' as const,
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-sonnet-20241022',
      timeout: 60000,
      maxRetries: 3,
    });
  }
  
  // Grok via OpenLux
  if (process.env.OPENLUX_API_KEY) {
    providers.push({
      type: 'grok' as const,
      apiKey: process.env.OPENLUX_API_KEY,
      baseURL: 'https://api.openlux.ai/v1',
      model: 'claude-opus-5:stable',
      timeout: 60000,
      maxRetries: 3,
    });
  }
  
  if (providers.length === 0) {
    console.error('❌ No API keys configured. Please set environment variables.');
    console.log('\nRequired environment variables:');
    console.log('  - OPENAI_API_KEY (for OpenAI)');
    console.log('  - ANTHROPIC_API_KEY (for Anthropic)');
    console.log('  - OPENLUX_API_KEY (for Grok)');
    process.exit(1);
  }
  
  console.log(`✅ Configured ${providers.length} provider(s):`);
  providers.forEach(p => console.log(`   - ${p.type} (${p.model})`));
  
  // Create benchmark suite
  const suite = new BenchmarkSuite({
    providers,
    outputDir: './reports',
    parallelism: 3,
    debugMode: false,
  });
  
  // Run all benchmarks
  console.log('\n🚀 Starting benchmark suite...\n');
  
  try {
    await suite.runAll();
    console.log('\n✨ Benchmark completed successfully!');
    console.log('📊 Reports saved to ./reports');
    console.log('🔍 Traces saved to ./traces');
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
}

main();
