#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { BenchmarkSuite } from '../benchmarks/index.js';
import type { ProviderConfig } from '../types.js';

const program = new Command();

program
  .name('cortex-test')
  .description('Test harness for AI provider benchmarking')
  .version('0.1.0');

program
  .command('benchmark')
  .description('Run benchmark suite')
  .option('-s, --suite <type>', 'Benchmark suite to run (all, codegen, debug, refactor, explain)', 'all')
  .option('-p, --providers <providers>', 'Comma-separated list of providers (openai, anthropic, grok)', 'openai,anthropic,grok')
  .option('-o, --output <dir>', 'Output directory for reports', './reports')
  .option('--parallelism <n>', 'Number of parallel test executions', '3')
  .option('--debug', 'Enable debug mode', false)
  .action(async (options) => {
    const spinner = ora('Initializing benchmark suite...').start();
    
    try {
      const providers = loadProviders(options.providers.split(','));
      
      if (providers.length === 0) {
        spinner.fail(chalk.red('No valid providers configured. Please set API keys in environment variables.'));
        process.exit(1);
      }
      
      spinner.succeed(chalk.green(`Loaded ${providers.length} provider(s): ${providers.map(p => p.type).join(', ')}`));
      
      const suite = new BenchmarkSuite({
        providers,
        outputDir: options.output,
        parallelism: parseInt(options.parallelism),
        debugMode: options.debug,
      });
      
      switch (options.suite) {
        case 'all':
          await suite.runAll();
          break;
        case 'codegen':
          await suite.runCodeGeneration();
          break;
        case 'debug':
          await suite.runDebugging();
          break;
        case 'refactor':
          await suite.runRefactoring();
          break;
        case 'explain':
          await suite.runExplanation();
          break;
        default:
          console.error(chalk.red(`Unknown suite: ${options.suite}`));
          process.exit(1);
      }
      
      console.log(chalk.green('\n✨ Benchmark completed successfully!'));
    } catch (error) {
      spinner.fail(chalk.red('Benchmark failed'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('trace')
  .description('Trace management commands')
  .option('-c, --compare <id1,id2>', 'Compare two traces')
  .option('-v, --view <id>', 'View a trace')
  .option('--traces-dir <dir>', 'Traces directory', './traces')
  .action(async (options) => {
    const { TraceStorage } = await import('../utils/trace-storage.js');
    const storage = new TraceStorage(options.tracesDir);
    
    if (options.compare) {
      const [id1, id2] = options.compare.split(',');
      console.log(chalk.blue(`\n🔍 Comparing traces: ${id1} vs ${id2}\n`));
      
      try {
        const diff = await storage.compareTraces(id1, id2);
        const report = storage.generateDiffReport(diff);
        console.log(report);
      } catch (error) {
        console.error(chalk.red('Error comparing traces:'), error);
        process.exit(1);
      }
    } else if (options.view) {
      console.log(chalk.blue(`\n📄 Viewing trace: ${options.view}\n`));
      
      try {
        const trace = await storage.loadTrace(options.view);
        console.log(JSON.stringify(trace, null, 2));
      } catch (error) {
        console.error(chalk.red('Error loading trace:'), error);
        process.exit(1);
      }
    } else {
      console.error(chalk.red('Please specify --compare or --view'));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    console.log(chalk.blue('\n⚙️  Configuration\n'));
    
    console.log(chalk.bold('Environment Variables:'));
    console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? chalk.green('✓ Set') : chalk.red('✗ Not set')}`);
    console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? chalk.green('✓ Set') : chalk.red('✗ Not set')}`);
    console.log(`  OPENLUX_API_KEY: ${process.env.OPENLUX_API_KEY ? chalk.green('✓ Set') : chalk.red('✗ Not set')}`);
    
    console.log(chalk.bold('\nAvailable Providers:'));
    const providers = loadProviders(['openai', 'anthropic', 'grok']);
    for (const provider of providers) {
      console.log(`  ${chalk.green('✓')} ${provider.type} (${provider.model})`);
    }
    
    if (providers.length === 0) {
      console.log(chalk.yellow('  No providers configured. Set API keys to enable providers.'));
    }
  });

function loadProviders(providerTypes: string[]): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  
  for (const type of providerTypes) {
    let config: ProviderConfig | null = null;
    
    switch (type.trim()) {
      case 'openai':
        if (process.env.OPENAI_API_KEY) {
          config = {
            type: 'openai',
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_MODEL || 'gpt-4',
            timeout: 60000,
            maxRetries: 3,
          };
        }
        break;
        
      case 'anthropic':
        if (process.env.ANTHROPIC_API_KEY) {
          config = {
            type: 'anthropic',
            apiKey: process.env.ANTHROPIC_API_KEY,
            model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
            timeout: 60000,
            maxRetries: 3,
          };
        }
        break;
        
      case 'grok':
        if (process.env.OPENLUX_API_KEY) {
          config = {
            type: 'grok',
            apiKey: process.env.OPENLUX_API_KEY,
            baseURL: process.env.OPENLUX_BASE_URL || 'https://api.openlux.ai/v1',
            model: process.env.OPENLUX_MODEL || 'claude-opus-5:stable',
            timeout: 60000,
            maxRetries: 3,
          };
        }
        break;
    }
    
    if (config) {
      providers.push(config);
    }
  }
  
  return providers;
}

program.parse();
