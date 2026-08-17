# Test Harness

Comprehensive test harness for AI provider benchmarking and agent trace collection in Cortex IDE.

## Features

- 🔧 **Multi-Provider Support**: Test OpenAI, Anthropic, and Grok (via OpenLux API)
- 📊 **Comprehensive Benchmarks**: Code generation, debugging, refactoring, and explanation tests
- 📈 **Performance Metrics**: Track tokens, latency, cost, and success rates
- 🔍 **Trace Collection**: Record all agent interactions for analysis and replay
- 📝 **Multiple Report Formats**: JSON, Markdown, and HTML reports with visualizations
- ⚡ **Parallel Execution**: Configurable worker pool for fast test execution
- 🐛 **Debug Mode**: Verbose logging for troubleshooting

## Installation

```bash
cd packages/test-harness
bun install
bun run build
```

## Configuration

Set up your API keys:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENLUX_API_KEY="sk-O1XOv8M7uO9MhEx0js7kkdWe0GfZVwne9WojDnyT0byKqsVj"
```

Optional model configuration:

```bash
export OPENAI_MODEL="gpt-4"
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
export OPENLUX_MODEL="claude-opus-5:stable"
export OPENLUX_BASE_URL="https://api.openlux.ai/v1"
```

## CLI Usage

### Check Configuration

```bash
cortex-test config
```

### Run Benchmarks

Run all benchmarks:
```bash
cortex-test benchmark --suite all
```

Run specific benchmark suites:
```bash
cortex-test benchmark --suite codegen
cortex-test benchmark --suite debug
cortex-test benchmark --suite refactor
cortex-test benchmark --suite explain
```

Test specific providers:
```bash
cortex-test benchmark --providers openai,anthropic
cortex-test benchmark --providers grok
```

Custom output directory:
```bash
cortex-test benchmark --output ./my-reports
```

Adjust parallelism:
```bash
cortex-test benchmark --parallelism 5
```

Enable debug mode:
```bash
cortex-test benchmark --debug
```

### Trace Management

View a trace:
```bash
cortex-test trace --view <trace-id>
```

Compare two traces:
```bash
cortex-test trace --compare <trace-id-1>,<trace-id-2>
```

Custom traces directory:
```bash
cortex-test trace --traces-dir ./my-traces --view <trace-id>
```

## Programmatic Usage

```typescript
import { BenchmarkSuite, createProvider } from '@cortex-ide/test-harness';

const providers = [
  {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4',
    timeout: 60000,
    maxRetries: 3,
  },
  {
    type: 'grok',
    apiKey: process.env.OPENLUX_API_KEY!,
    baseURL: 'https://api.openlux.ai/v1',
    model: 'claude-opus-5:stable',
    timeout: 60000,
    maxRetries: 3,
  },
];

const suite = new BenchmarkSuite({
  providers,
  outputDir: './reports',
  parallelism: 3,
  debugMode: false,
});

await suite.runAll();
```

### Custom Test Cases

```typescript
import { TestRunner, type TestCase } from '@cortex-ide/test-harness';

const customTest: TestCase = {
  id: 'custom-01',
  name: 'My Custom Test',
  description: 'Test custom functionality',
  prompt: 'Your test prompt here',
  expectedOutputPattern: 'expected.*pattern',
  timeout: 30000,
};

const runner = new TestRunner({ debugMode: true });
const result = await runner.runTest(customTest, providers[0]);

console.log(result);
```

## Benchmark Suites

### Code Generation
- Simple functions with type annotations
- React components
- API handlers
- Algorithm implementations
- Classes with inheritance

### Debugging
- Syntax error detection
- Logic error fixes
- Memory leak identification

### Refactoring
- Function extraction
- Conditional simplification

### Explanation
- Algorithm explanations
- Design pattern descriptions
- Programming concept clarifications

## Report Formats

### JSON
Raw structured data for programmatic analysis.

### Markdown
Human-readable report with tables and statistics.

### HTML
Interactive report with charts and visualizations.

## Trace Collection

Traces capture:
- All messages (system, user, assistant)
- Tool calls and results
- Token usage (prompt, completion, total)
- Latency measurements
- Cost calculations
- Error information
- Custom metadata

Traces are saved to `traces/` directory and can be:
- Viewed individually
- Compared side-by-side
- Replayed for debugging
- Exported for analysis

## Architecture

```
test-harness/
├── src/
│   ├── core/          # Core test execution framework
│   │   ├── test-runner.ts
│   │   ├── benchmark-runner.ts
│   │   └── trace-recorder.ts
│   ├── providers/     # AI provider implementations
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── grok.ts
│   ├── utils/         # Utilities
│   │   ├── report-generator.ts
│   │   └── trace-storage.ts
│   ├── benchmarks/    # Benchmark suites
│   │   ├── test-cases.ts
│   │   └── index.ts
│   └── cli/           # CLI interface
│       └── index.ts
├── benchmarks/        # Benchmark results (generated)
├── traces/           # Trace files (generated)
└── reports/          # Test reports (generated)
```

## License

MIT
