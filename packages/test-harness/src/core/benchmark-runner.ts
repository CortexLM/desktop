import { randomUUID } from 'crypto';
import type { BenchmarkResult, TestCase, ProviderConfig, TestResult } from '../types.js';
import { TestRunner, type TestRunnerOptions } from './test-runner.js';

export interface BenchmarkOptions extends TestRunnerOptions {
  parallelism?: number;
  providers: ProviderConfig[];
}

export class BenchmarkRunner {
  private testRunner: TestRunner;
  
  constructor(options: TestRunnerOptions = {}) {
    this.testRunner = new TestRunner(options);
  }
  
  async runBenchmark(
    name: string,
    description: string,
    testCases: TestCase[],
    options: BenchmarkOptions
  ): Promise<BenchmarkResult> {
    const benchmarkId = randomUUID();
    const startTime = Date.now();
    
    console.log(`\n🚀 Starting benchmark: ${name}`);
    console.log(`   ${description}`);
    console.log(`   Test cases: ${testCases.length}`);
    console.log(`   Providers: ${options.providers.map(p => p.type).join(', ')}\n`);
    
    const results: TestResult[] = [];
    const parallelism = options.parallelism ?? 3;
    
    // Create test matrix: each test case × each provider
    const testMatrix: Array<{ testCase: TestCase; provider: ProviderConfig }> = [];
    for (const testCase of testCases) {
      for (const provider of options.providers) {
        testMatrix.push({ testCase, provider });
      }
    }
    
    // Run tests with parallelism control
    const chunks = this.chunkArray(testMatrix, parallelism);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(({ testCase, provider }) =>
          this.testRunner.runTest(testCase, provider, options)
        )
      );
      
      results.push(...chunkResults);
    }
    
    const totalDuration = Date.now() - startTime;
    
    const summary = {
      totalTests: results.length,
      successfulTests: results.filter(r => r.status === 'success').length,
      failedTests: results.filter(r => r.status !== 'success').length,
      totalDuration,
      totalCost: results.reduce((sum, r) => sum + r.metrics.totalCost, 0),
    };
    
    console.log(`\n✅ Benchmark completed in ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   Success: ${summary.successfulTests}/${summary.totalTests}`);
    console.log(`   Total cost: $${summary.totalCost.toFixed(4)}\n`);
    
    return {
      benchmarkId,
      benchmarkName: name,
      description,
      providers: options.providers.map(p => p.type),
      results,
      summary,
      timestamp: startTime,
    };
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
