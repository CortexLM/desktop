import { describe, it, expect, vi, beforeEach } from 'vitest';

const runBenchmark = vi.fn(async (name: string, description: string, cases: unknown[]) => ({
  benchmarkId: 'b1',
  benchmarkName: name,
  description,
  providers: ['openai'],
  results: [],
  summary: {
    totalTests: (cases as unknown[]).length,
    successfulTests: 0,
    failedTests: 0,
    totalDuration: 1,
    totalCost: 0,
  },
  timestamp: 1,
}));

vi.mock('../../core/benchmark-runner.js', () => ({
  BenchmarkRunner: class {
    runBenchmark = runBenchmark;
  },
}));

vi.mock('../../utils/report-generator.js', () => ({
  ReportGenerator: class {
    generateJSON = vi.fn(async () => undefined);
    generateMarkdown = vi.fn(async () => undefined);
    generateHTML = vi.fn(async () => undefined);
  },
}));

import { BenchmarkSuite } from '../index.js';

describe('BenchmarkSuite', () => {
  beforeEach(() => {
    runBenchmark.mockClear();
  });

  it('runs every predefined suite', async () => {
    const suite = new BenchmarkSuite({
      providers: [{ type: 'openai', apiKey: 'test', model: 'gpt-4' }],
      outputDir: '/tmp/cortex-bench-test',
    });

    const results = await suite.runAll();
    expect(results).toHaveLength(4);
    expect(runBenchmark).toHaveBeenCalledTimes(4);
    expect(runBenchmark.mock.calls.map((call) => call[0])).toEqual([
      'Code generation',
      'Debugging',
      'Refactoring',
      'Explanation',
    ]);
  });
});
