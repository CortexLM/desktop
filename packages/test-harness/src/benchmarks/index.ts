import { mkdir } from 'fs/promises';
import { BenchmarkRunner } from '../core/benchmark-runner.js';
import { ReportGenerator } from '../utils/report-generator.js';
import type { BenchmarkResult, ProviderConfig, TestCase } from '../types.js';

export interface BenchmarkSuiteOptions {
  providers: ProviderConfig[];
  outputDir?: string;
  parallelism?: number;
  debugMode?: boolean;
}

const CODEGEN: TestCase[] = [
  {
    id: 'codegen-function',
    name: 'Pure function',
    description: 'Generate a small typed helper',
    prompt: 'Write a TypeScript function that sums an array of numbers. Return only the function.',
  },
  {
    id: 'codegen-api',
    name: 'HTTP handler',
    description: 'Generate a request handler',
    prompt: 'Write an Express handler that returns { ok: true } as JSON.',
  },
];

const DEBUG: TestCase[] = [
  {
    id: 'debug-syntax',
    name: 'Syntax error',
    description: 'Spot a missing brace',
    prompt: 'Find the bug: function add(a, b { return a + b; }',
  },
  {
    id: 'debug-logic',
    name: 'Off-by-one',
    description: 'Fix a loop bound',
    prompt: 'This loop skips the last item. Fix it: for (let i = 0; i < items.length - 1; i++) {}',
  },
];

const REFACTOR: TestCase[] = [
  {
    id: 'refactor-extract',
    name: 'Extract function',
    description: 'Pull duplicated logic into a helper',
    prompt: 'Refactor this so the repeated tax calculation is a function: const a = price * 1.2; const b = fee * 1.2;',
  },
];

const EXPLAIN: TestCase[] = [
  {
    id: 'explain-algorithm',
    name: 'Explain binary search',
    description: 'Describe an algorithm in plain language',
    prompt: 'Explain binary search in four sentences.',
  },
];

/**
 * Pre-defined provider benchmark suites consumed by the `cortex-test` CLI.
 * Measures latency, tokens, and cost — not answer quality.
 */
export class BenchmarkSuite {
  private readonly runner = new BenchmarkRunner();
  private readonly reports = new ReportGenerator();

  constructor(private readonly options: BenchmarkSuiteOptions) {}

  async runCodeGeneration(): Promise<BenchmarkResult> {
    return this.run('Code generation', 'Generate functions and handlers', CODEGEN);
  }

  async runDebugging(): Promise<BenchmarkResult> {
    return this.run('Debugging', 'Find and fix small defects', DEBUG);
  }

  async runRefactoring(): Promise<BenchmarkResult> {
    return this.run('Refactoring', 'Restructure existing snippets', REFACTOR);
  }

  async runExplanation(): Promise<BenchmarkResult> {
    return this.run('Explanation', 'Explain algorithms and concepts', EXPLAIN);
  }

  async runAll(): Promise<BenchmarkResult[]> {
    return [
      await this.runCodeGeneration(),
      await this.runDebugging(),
      await this.runRefactoring(),
      await this.runExplanation(),
    ];
  }

  private async run(
    name: string,
    description: string,
    testCases: TestCase[]
  ): Promise<BenchmarkResult> {
    const result = await this.runner.runBenchmark(name, description, testCases, {
      providers: this.options.providers,
      parallelism: this.options.parallelism,
      debugMode: this.options.debugMode,
    });

    const outputDir = this.options.outputDir ?? './reports';
    await mkdir(outputDir, { recursive: true });
    await this.reports.generateJSON(result, outputDir);
    await this.reports.generateMarkdown(result, outputDir);
    return result;
  }
}
