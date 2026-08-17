import { randomUUID } from 'crypto';
import type { TraceEntry, Message, ToolCall, ProviderType } from '../types.js';

export class TraceRecorder {
  private traces: TraceEntry[] = [];
  private currentTrace: Partial<TraceEntry> | null = null;
  
  startTrace(provider: ProviderType, model: string, messages: Message[]): string {
    const traceId = randomUUID();
    
    this.currentTrace = {
      id: traceId,
      timestamp: Date.now(),
      provider,
      model,
      messages: messages.map(m => ({ ...m, timestamp: m.timestamp ?? Date.now() })),
      toolCalls: [],
    };
    
    return traceId;
  }
  
  addToolCall(toolCall: ToolCall): void {
    if (!this.currentTrace) {
      throw new Error('No active trace');
    }
    
    if (!this.currentTrace.toolCalls) {
      this.currentTrace.toolCalls = [];
    }
    
    this.currentTrace.toolCalls.push(toolCall);
  }
  
  endTrace(
    response: Message,
    tokensUsed: { prompt: number; completion: number; total: number },
    latency: number,
    cost?: number,
    error?: string
  ): TraceEntry {
    if (!this.currentTrace) {
      throw new Error('No active trace');
    }
    
    const trace: TraceEntry = {
      ...this.currentTrace as TraceEntry,
      response,
      tokensUsed,
      latency,
      cost,
      error,
    };
    
    this.traces.push(trace);
    this.currentTrace = null;
    
    return trace;
  }
  
  getTraces(): TraceEntry[] {
    return [...this.traces];
  }
  
  getTrace(traceId: string): TraceEntry | undefined {
    return this.traces.find(t => t.id === traceId);
  }
  
  clear(): void {
    this.traces = [];
    this.currentTrace = null;
  }
  
  exportTraces(): string {
    return JSON.stringify(this.traces, null, 2);
  }
  
  importTraces(json: string): void {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      this.traces = parsed;
    }
  }
}
