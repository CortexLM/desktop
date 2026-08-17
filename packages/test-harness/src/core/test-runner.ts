import { randomUUID } from 'crypto';
import type { TestCase, TestResult, ProviderConfig, Message, TraceEntry } from '../types.js';
import { createProvider, type AIProvider } from '../providers/index.js';
import { TraceRecorder } from './trace-recorder.js';

export interface TestRunnerOptions {
  timeout?: number;
  debugMode?: boolean;
  onProgress?: (progress: TestProgress) => void;
}

export interface TestProgress {
  testId: string;
  testName: string;
  provider: string;
  status: 'running' | 'success' | 'failure' | 'timeout';
  elapsed: number;
}

export class TestRunner {
  private traceRecorder: TraceRecorder;
  private debugMode: boolean;
  
  constructor(options: TestRunnerOptions = {}) {
    this.traceRecorder = new TraceRecorder();
    this.debugMode = options.debugMode ?? false;
  }
  
  async runTest(
    testCase: TestCase,
    providerConfig: ProviderConfig,
    options: TestRunnerOptions = {}
  ): Promise<TestResult> {
    const testId = randomUUID();
    const startTime = Date.now();
    const timeout = testCase.timeout ?? options.timeout ?? 120000;
    
    this.log(`Running test: ${testCase.name} with provider: ${providerConfig.type}`);
    
    options.onProgress?.({
      testId,
      testName: testCase.name,
      provider: providerConfig.type,
      status: 'running',
      elapsed: 0,
    });
    
    try {
      const provider = createProvider(providerConfig);
      
      const result = await this.executeTestWithTimeout(
        testCase,
        provider,
        providerConfig,
        timeout
      );
      
      const duration = Date.now() - startTime;
      
      options.onProgress?.({
        testId,
        testName: testCase.name,
        provider: providerConfig.type,
        status: result.status,
        elapsed: duration,
      });
      
      return {
        ...result,
        testId,
        testName: testCase.name,
        duration,
        timestamp: startTime,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log(`Test failed: ${errorMessage}`, 'error');
      
      const status: 'timeout' | 'failure' = errorMessage.includes('Timeout') ? 'timeout' : 'failure';
      
      options.onProgress?.({
        testId,
        testName: testCase.name,
        provider: providerConfig.type,
        status: 'failure',
        elapsed: duration,
      });
      
      return {
        testId,
        testName: testCase.name,
        provider: providerConfig.type,
        model: providerConfig.model,
        status,
        duration,
        traces: this.traceRecorder.getTraces(),
        metrics: {
          totalTokens: 0,
          totalCost: 0,
          averageLatency: 0,
          successRate: 0,
        },
        error: errorMessage,
        timestamp: startTime,
      };
    } finally {
      this.traceRecorder.clear();
    }
  }
  
  private async executeTestWithTimeout(
    testCase: TestCase,
    provider: AIProvider,
    providerConfig: ProviderConfig,
    timeout: number
  ): Promise<Omit<TestResult, 'testId' | 'testName' | 'duration' | 'timestamp'>> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout)
    );
    
    const testPromise = this.executeTest(testCase, provider, providerConfig);
    
    return Promise.race([testPromise, timeoutPromise]);
  }
  
  private async executeTest(
    testCase: TestCase,
    provider: AIProvider,
    providerConfig: ProviderConfig
  ): Promise<Omit<TestResult, 'testId' | 'testName' | 'duration' | 'timestamp'>> {
    const messages: Message[] = [
      {
        role: 'user',
        content: testCase.prompt,
        timestamp: Date.now(),
      },
    ];
    
    // Start trace recording
    const traceId = this.traceRecorder.startTrace(
      providerConfig.type,
      providerConfig.model,
      messages
    );
    
    this.log(`Started trace: ${traceId}`);
    
    try {
      // Execute the chat
      const response = await provider.chat(messages);
      
      this.log(`Received response: ${response.content.substring(0, 100)}...`);
      
      // End trace recording
      this.traceRecorder.endTrace(
        {
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
        },
        response.tokensUsed,
        response.latency,
        response.cost
      );
      
      // Validate output if pattern provided
      let status: 'success' | 'failure' = 'success';
      let error: string | undefined;
      
      if (testCase.expectedOutputPattern) {
        const regex = new RegExp(testCase.expectedOutputPattern, 'i');
        if (!regex.test(response.content)) {
          status = 'failure';
          error = `Output does not match expected pattern: ${testCase.expectedOutputPattern}`;
          this.log(error, 'warn');
        }
      }
      
      const traces = this.traceRecorder.getTraces();
      
      return {
        provider: providerConfig.type,
        model: providerConfig.model,
        status,
        traces,
        metrics: this.calculateMetrics(traces),
        output: response.content,
        error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.traceRecorder.endTrace(
        {
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        },
        { prompt: 0, completion: 0, total: 0 },
        0,
        0,
        errorMessage
      );
      
      throw error;
    }
  }
  
  private calculateMetrics(traces: TraceEntry[]): {
    totalTokens: number;
    totalCost: number;
    averageLatency: number;
    successRate: number;
  } {
    if (traces.length === 0) {
      return {
        totalTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        successRate: 0,
      };
    }
    
    const totalTokens = traces.reduce((sum, t) => sum + (t.tokensUsed?.total ?? 0), 0);
    const totalCost = traces.reduce((sum, t) => sum + (t.cost ?? 0), 0);
    const averageLatency = traces.reduce((sum, t) => sum + t.latency, 0) / traces.length;
    const successCount = traces.filter(t => !t.error).length;
    const successRate = successCount / traces.length;
    
    return {
      totalTokens,
      totalCost,
      averageLatency,
      successRate,
    };
  }
  
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (this.debugMode) {
      const prefix = `[TestRunner ${new Date().toISOString()}]`;
      switch (level) {
        case 'info':
          console.log(`${prefix} ${message}`);
          break;
        case 'warn':
          console.warn(`${prefix} ${message}`);
          break;
        case 'error':
          console.error(`${prefix} ${message}`);
          break;
      }
    }
  }
}
