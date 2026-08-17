# Cortex IDE Test Harness - Quick Start Guide

## Installation

```bash
cd packages/test-harness
bun install
bun run build
```

## Setup API Keys

Create a `.env` file (or set environment variables):

```bash
# Copy the example file
cp .env.example .env

# Edit with your API keys
nano .env
```

At minimum, add the Grok/OpenLux API key:

```bash
OPENLUX_API_KEY=sk-O1XOv8M7uO9MhEx0js7kkdWe0GfZVwne9WojDnyT0byKqsVj
OPENLUX_MODEL=claude-opus-5:stable
OPENLUX_BASE_URL=https://api.openlux.ai/v1
```

## Verify Configuration

```bash
bun run dist/cli/index.js config
```

Expected output:
```
⚙️  Configuration

Environment Variables:
  OPENAI_API_KEY: ✗ Not set
  ANTHROPIC_API_KEY: ✗ Not set
  OPENLUX_API_KEY: ✓ Set

Available Providers:
  ✓ grok (claude-opus-5:stable)
```

## Run Your First Benchmark

### Test a single provider (Grok)

```bash
OPENLUX_API_KEY=sk-O1XOv8M7uO9MhEx0js7kkdWe0GfZVwne9WojDnyT0byKqsVj \
  bun run dist/cli/index.js benchmark --suite codegen --providers grok
```

This will:
- Run 5 code generation tests
- Generate reports in `./reports/` (JSON, Markdown, HTML)
- Save traces in `./traces/`

### Run all benchmark suites

```bash
OPENLUX_API_KEY=sk-O1XOv8M7uO9MhEx0js7kkdWe0GfZVwne9WojDnyT0byKqsVj \
  bun run dist/cli/index.js benchmark --suite all --providers grok --debug
```

Available suites:
- `all` - All tests (code generation, debugging, refactoring, explanation)
- `codegen` - Code generation tests
- `debug` - Debugging tests
- `refactor` - Refactoring tests
- `explain` - Explanation tests

## Run Examples

### Test Grok Provider

```bash
cd examples
OPENLUX_API_KEY=sk-O1XOv8M7uO9MhEx0js7kkdWe0GfZVwne9WojDnyT0byKqsVj \
  bun test-grok.ts
```

### Run Custom Test

```bash
cd examples
OPENLUX_API_KEY=sk-O1XOv8M7uO9MhEx0js7kkdWe0GfZVwne9WojDnyT0byKqsVj \
  bun custom-test.ts
```

### Full Benchmark Suite

```bash
cd examples
OPENLUX_API_KEY=sk-O1XOv8M7uO9MhEx0js7kkdWe0GfZVwne9WojDnyT0byKqsVj \
  bun run-benchmark.ts
```

## View Results

After running benchmarks:

1. **HTML Report** (interactive): Open `reports/benchmark-*.html` in a browser
2. **Markdown Report**: View `reports/benchmark-*.md`
3. **JSON Data**: Parse `reports/benchmark-*.json` programmatically

## Trace Management

### View a trace

```bash
bun run dist/cli/index.js trace --view <trace-id>
```

### Compare two traces

```bash
bun run dist/cli/index.js trace --compare <trace-id-1>,<trace-id-2>
```

Or use the example:

```bash
cd examples
bun compare-traces.ts <trace-id-1> <trace-id-2>
```

## CLI Options

### Benchmark Command

```bash
cortex-test benchmark [options]
```

Options:
- `-s, --suite <type>` - Suite to run (all, codegen, debug, refactor, explain)
- `-p, --providers <list>` - Comma-separated providers (openai, anthropic, grok)
- `-o, --output <dir>` - Output directory (default: ./reports)
- `--parallelism <n>` - Parallel executions (default: 3)
- `--debug` - Enable debug mode

### Trace Command

```bash
cortex-test trace [options]
```

Options:
- `-c, --compare <id1,id2>` - Compare two traces
- `-v, --view <id>` - View a trace
- `--traces-dir <dir>` - Traces directory (default: ./traces)

## Integration with Cortex IDE

To integrate the test harness into your Cortex IDE workflow:

```typescript
import { createProvider, TestRunner } from '@cortex-ide/test-harness';

// Create provider from your AI engine config
const provider = createProvider({
  type: 'grok',
  apiKey: config.apiKey,
  baseURL: 'https://api.openlux.ai/v1',
  model: 'claude-opus-5:stable',
  timeout: 60000,
  maxRetries: 3,
});

// Run tests
const runner = new TestRunner({ debugMode: true });
const result = await runner.runTest(testCase, providerConfig);

// Access traces, metrics, etc.
console.log(result.metrics);
```

## Troubleshooting

### "No providers configured"

Make sure your API key environment variables are set:
```bash
export OPENLUX_API_KEY=sk-O1XOv8M7uO9MhEx0js7kkdWe0GfZVwne9WojDnyT0byKqsVj
```

### "Timeout" errors

Increase timeout in provider config:
```typescript
{
  timeout: 120000, // 2 minutes
}
```

Or use the `--debug` flag to see detailed logs.

### Build errors

```bash
rm -rf dist node_modules
bun install
bun run build
```

## Next Steps

1. **Add more providers**: Set `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` to compare providers
2. **Create custom tests**: See `examples/custom-test.ts`
3. **Integrate with CI/CD**: Run benchmarks on every deploy
4. **Monitor costs**: Track token usage and costs in reports
5. **Compare models**: Test different models from the same provider

## Support

For issues or questions:
- Check the main README.md
- Review examples in `examples/`
- Enable `--debug` mode for verbose logs
