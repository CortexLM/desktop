import { z } from 'zod';

// Provider types
export const ProviderTypeSchema = z.enum(['openai', 'anthropic', 'grok']);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

// Provider configuration
export const ProviderConfigSchema = z.object({
  type: ProviderTypeSchema,
  apiKey: z.string(),
  baseURL: z.string().optional(),
  model: z.string(),
  timeout: z.number().default(60000),
  maxRetries: z.number().default(3),
  rateLimit: z.number().optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// Message types
export const MessageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
  timestamp: z.number(),
  metadata: z.record(z.unknown()).optional(),
});
export type Message = z.infer<typeof MessageSchema>;

// Tool call
export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
  result: z.unknown().optional(),
  error: z.string().optional(),
  timestamp: z.number(),
  duration: z.number().optional(),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

// Trace entry
export const TraceEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  provider: ProviderTypeSchema,
  model: z.string(),
  messages: z.array(MessageSchema),
  toolCalls: z.array(ToolCallSchema).optional(),
  response: MessageSchema.optional(),
  tokensUsed: z.object({
    prompt: z.number(),
    completion: z.number(),
    total: z.number(),
  }).optional(),
  latency: z.number(),
  cost: z.number().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type TraceEntry = z.infer<typeof TraceEntrySchema>;

// Test result
export const TestResultSchema = z.object({
  testId: z.string(),
  testName: z.string(),
  provider: ProviderTypeSchema,
  model: z.string(),
  status: z.enum(['success', 'failure', 'timeout']),
  duration: z.number(),
  traces: z.array(TraceEntrySchema),
  metrics: z.object({
    totalTokens: z.number(),
    totalCost: z.number(),
    averageLatency: z.number(),
    successRate: z.number(),
  }),
  output: z.unknown().optional(),
  error: z.string().optional(),
  timestamp: z.number(),
});
export type TestResult = z.infer<typeof TestResultSchema>;

// Benchmark result
export const BenchmarkResultSchema = z.object({
  benchmarkId: z.string(),
  benchmarkName: z.string(),
  description: z.string(),
  providers: z.array(ProviderTypeSchema),
  results: z.array(TestResultSchema),
  summary: z.object({
    totalTests: z.number(),
    successfulTests: z.number(),
    failedTests: z.number(),
    totalDuration: z.number(),
    totalCost: z.number(),
  }),
  timestamp: z.number(),
});
export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;

// Harness configuration
export const HarnessConfigSchema = z.object({
  providers: z.array(ProviderConfigSchema),
  timeout: z.number().default(120000),
  parallelism: z.number().default(3),
  debugMode: z.boolean().default(false),
  tracesDir: z.string().default('./traces'),
  reportsDir: z.string().default('./reports'),
});
export type HarnessConfig = z.infer<typeof HarnessConfigSchema>;

// Test case
export const TestCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  prompt: z.string(),
  expectedOutputPattern: z.string().optional(),
  timeout: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type TestCase = z.infer<typeof TestCaseSchema>;
