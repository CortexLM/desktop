# Test Harness Architecture

## Overview

The Test Harness is a comprehensive framework for benchmarking AI providers and collecting agent execution traces. It's designed to be flexible, extensible, and production-ready.

## Core Components

### 1. Types (`types.ts`)

Central type definitions using Zod for runtime validation:

- **ProviderConfig**: Configuration for AI providers (API keys, models, timeouts)
- **Message**: Chat messages with roles and timestamps
- **ToolCall**: Function/tool invocations with results
- **TraceEntry**: Complete execution trace with metrics
- **TestResult**: Individual test execution result
- **BenchmarkResult**: Aggregated benchmark results
- **TestCase**: Test definition with prompt and validation

### 2. Providers (`providers/`)

Abstraction layer for different AI providers:

```
BaseProvider (abstract)
├── OpenAIProvider
├── AnthropicProvider
└── GrokProvider
```

**Key Features:**
- Unified interface across providers
- Automatic retry with exponential backoff
- Timeout management
- Token tracking and cost calculation
- Streaming support

**Implementation Pattern:**
```typescript
class OpenAIProvider extends BaseProvider {
  async chat(messages, options): Promise<ChatResponse>
  async *streamChat(messages, options): AsyncGenerator<ChatStreamChunk>
  protected calculateCost(tokensUsed): number
}
```

### 3. Core Framework (`core/`)

#### TraceRecorder
Records all AI interactions for analysis and replay:

```typescript
class TraceRecorder {
  startTrace(provider, model, messages): traceId
  addToolCall(toolCall): void
  endTrace(response, tokens, latency, cost): TraceEntry
  getTraces(): TraceEntry[]
}
```

#### TestRunner
Executes individual test cases:

```typescript
class TestRunner {
  async runTest(testCase, providerConfig): Promise<TestResult>
}
```

**Features:**
- Timeout management
- Progress callbacks
- Trace collection
- Metric calculation
- Error handling

#### BenchmarkRunner
Orchestrates multiple tests across providers:

```typescript
class BenchmarkRunner {
  async runBenchmark(name, description, testCases, options): Promise<BenchmarkResult>
}
```

**Features:**
- Parallel execution with configurable workers
- Provider comparison
- Aggregate metrics
- Report generation

### 4. Utilities (`utils/`)

#### ReportGenerator
Creates reports in multiple formats:

```typescript
class ReportGenerator {
  async generateJSON(result, outputPath): Promise<void>
  async generateMarkdown(result, outputPath): Promise<void>
  async generateHTML(result, outputPath): Promise<void>
}
```

**HTML Reports Include:**
- Summary cards (total tests, success rate, cost)
- Provider comparison charts
- Detailed test results tables
- Interactive visualizations

#### TraceStorage
Manages trace persistence and analysis:

```typescript
class TraceStorage {
  async saveTrace(trace): Promise<string>
  async loadTrace(traceId): Promise<TraceEntry>
  async compareTraces(id1, id2): Promise<TraceDiff>
  generateDiffReport(diff): string
}
```

### 5. Benchmarks (`benchmarks/`)

Pre-defined test suites:

- **Code Generation**: Functions, components, APIs, algorithms
- **Debugging**: Syntax errors, logic bugs, memory leaks
- **Refactoring**: Extract functions, simplify conditionals
- **Explanation**: Algorithms, patterns, concepts

### 6. CLI (`cli/`)

Command-line interface built with Commander.js:

```typescript
cortex-test benchmark [options]
cortex-test trace [options]
cortex-test config
```

## Data Flow

### Benchmark Execution Flow

```
1. CLI/API Entry
   └─> Parse config & load providers
       └─> BenchmarkRunner.runBenchmark()
           └─> For each test case × provider:
               └─> TestRunner.runTest()
                   ├─> TraceRecorder.startTrace()
                   ├─> Provider.chat()
                   ├─> TraceRecorder.endTrace()
                   └─> Return TestResult
           └─> Aggregate results
               └─> ReportGenerator.generate*()
               └─> TraceStorage.saveTraces()
```

### Provider Call Flow

```
1. TestRunner calls Provider.chat(messages)
   └─> BaseProvider.withTimeout()
       └─> BaseProvider.withRetry()
           └─> OpenAIProvider.chat() | AnthropicProvider.chat() | GrokProvider.chat()
               ├─> API call
               ├─> Parse response
               ├─> Calculate tokens & cost
               └─> Return ChatResponse
```

### Trace Collection

```
1. Start trace: recorder.startTrace(provider, model, messages)
   └─> Creates trace entry with ID and timestamp

2. Execute AI call
   └─> Provider returns response with tokens, latency, cost

3. End trace: recorder.endTrace(response, tokens, latency, cost)
   └─> Completes trace entry
   └─> Adds to traces array

4. Save: storage.saveTraces(traces, sessionId)
   └─> Writes JSON file to disk
```

## Extension Points

### Adding a New Provider

1. Create `src/providers/newprovider.ts`:

```typescript
import { BaseProvider } from './base.js';

export class NewProvider extends BaseProvider {
  get name(): string { return 'newprovider'; }
  get model(): string { return this.config.model; }
  
  async chat(messages, options) {
    // Implementation
  }
  
  async *streamChat(messages, options) {
    // Implementation
  }
  
  protected calculateCost(tokensUsed) {
    // Provider-specific pricing
  }
}
```

2. Register in `src/providers/index.ts`:

```typescript
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case 'newprovider':
      return new NewProvider(config);
    // ... other cases
  }
}
```

3. Update `src/cli/index.ts` to load credentials

### Adding Custom Test Suites

```typescript
// benchmarks/my-suite.ts
export const myTests: TestCase[] = [
  {
    id: 'my-01',
    name: 'My Test',
    prompt: 'Test prompt',
    expectedOutputPattern: 'pattern',
    timeout: 30000,
  },
];

// Use in code
import { myTests } from './benchmarks/my-suite.js';
await runner.runBenchmark('My Suite', 'Description', myTests, options);
```

### Custom Metrics

Extend `TraceEntry` type and add custom calculations in `TestRunner.calculateMetrics()`.

## Configuration

### Provider Configuration

```typescript
{
  type: 'openai' | 'anthropic' | 'grok',
  apiKey: string,
  baseURL?: string,      // Custom endpoint
  model: string,
  timeout: number,       // Request timeout (ms)
  maxRetries: number,    // Retry attempts
  rateLimit?: number,    // Requests per second
}
```

### Harness Configuration

```typescript
{
  providers: ProviderConfig[],
  timeout: number,           // Global timeout
  parallelism: number,       // Worker pool size
  debugMode: boolean,        // Verbose logging
  tracesDir: string,         // Trace storage path
  reportsDir: string,        // Report output path
}
```

## Performance Considerations

### Parallelism

Tests are executed in parallel batches controlled by `parallelism` setting:

```typescript
const chunks = this.chunkArray(testMatrix, parallelism);
for (const chunk of chunks) {
  const results = await Promise.all(
    chunk.map(({ testCase, provider }) => 
      this.testRunner.runTest(testCase, provider)
    )
  );
}
```

**Recommended values:**
- Small benchmarks: 3-5
- Large benchmarks: 5-10
- Rate-limited APIs: 1-3

### Memory Management

Traces are written to disk immediately after collection to prevent memory buildup during long benchmark runs.

### Timeouts

Three-level timeout hierarchy:
1. Provider timeout (request level)
2. Test case timeout (test level)
3. Global timeout (benchmark level)

## Error Handling

### Retry Strategy

Exponential backoff with jitter:

```typescript
const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
await new Promise(resolve => setTimeout(resolve, delay));
```

### Error Classification

- `timeout`: Request exceeded time limit
- `failure`: Test completed but validation failed
- `success`: Test completed and validated

## Testing

Run the test harness on itself:

```bash
# Self-test with a simple prompt
bun examples/test-grok.ts

# Full benchmark
bun examples/run-benchmark.ts
```

## Future Enhancements

### Planned Features

1. **Real-time monitoring**: WebSocket streaming of test progress
2. **Cost optimization**: Automatic provider selection based on cost/quality
3. **A/B testing**: Compare prompt variations
4. **Regression detection**: Alert on metric degradation
5. **Multi-model routing**: Load balancing across models
6. **Cache layer**: Reduce API calls for repeated prompts
7. **Custom validators**: Pluggable output validation logic
8. **Database integration**: Store results in PostgreSQL/SQLite

### Integration Opportunities

- **Cortex IDE**: Real-time provider selection
- **CI/CD**: Automated quality checks
- **Monitoring**: Grafana/Prometheus integration
- **Analytics**: BigQuery export for analysis

## Best Practices

1. **Start small**: Test with a subset of providers/tests first
2. **Use debug mode**: Enable for troubleshooting
3. **Monitor costs**: Track token usage in reports
4. **Version control traces**: Keep trace history for regression analysis
5. **Custom test cases**: Create domain-specific benchmarks
6. **Parallel tuning**: Adjust based on API rate limits
7. **Regular benchmarking**: Run weekly to track provider improvements

## License

MIT
