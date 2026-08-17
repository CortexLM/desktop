import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { TraceEntry } from '../types.js';

export class TraceStorage {
  constructor(private tracesDir: string) {}
  
  async saveTrace(trace: TraceEntry): Promise<string> {
    await mkdir(this.tracesDir, { recursive: true });
    
    const filename = `trace-${trace.id}.json`;
    const filepath = join(this.tracesDir, filename);
    
    await writeFile(filepath, JSON.stringify(trace, null, 2));
    
    return filepath;
  }
  
  async saveTraces(traces: TraceEntry[], sessionId?: string): Promise<string> {
    await mkdir(this.tracesDir, { recursive: true });
    
    const filename = sessionId 
      ? `session-${sessionId}.json`
      : `traces-${Date.now()}.json`;
    const filepath = join(this.tracesDir, filename);
    
    await writeFile(filepath, JSON.stringify(traces, null, 2));
    
    return filepath;
  }
  
  async loadTrace(traceId: string): Promise<TraceEntry> {
    const filename = `trace-${traceId}.json`;
    const filepath = join(this.tracesDir, filename);
    
    const content = await readFile(filepath, 'utf-8');
    return JSON.parse(content);
  }
  
  async loadTraces(sessionId: string): Promise<TraceEntry[]> {
    const filename = `session-${sessionId}.json`;
    const filepath = join(this.tracesDir, filename);
    
    const content = await readFile(filepath, 'utf-8');
    return JSON.parse(content);
  }
  
  async compareTraces(traceId1: string, traceId2: string): Promise<TraceDiff> {
    const trace1 = await this.loadTrace(traceId1);
    const trace2 = await this.loadTrace(traceId2);
    
    return {
      trace1,
      trace2,
      differences: {
        provider: trace1.provider !== trace2.provider,
        model: trace1.model !== trace2.model,
        latencyDiff: trace2.latency - trace1.latency,
        tokensDiff: (trace2.tokensUsed?.total ?? 0) - (trace1.tokensUsed?.total ?? 0),
        costDiff: (trace2.cost ?? 0) - (trace1.cost ?? 0),
        outputDiff: trace1.response?.content !== trace2.response?.content,
      },
    };
  }
  
  generateDiffReport(diff: TraceDiff): string {
    let report = '# Trace Comparison\n\n';
    
    report += `## Trace 1\n`;
    report += `- **ID:** ${diff.trace1.id}\n`;
    report += `- **Provider:** ${diff.trace1.provider}\n`;
    report += `- **Model:** ${diff.trace1.model}\n`;
    report += `- **Latency:** ${diff.trace1.latency}ms\n`;
    report += `- **Tokens:** ${diff.trace1.tokensUsed?.total ?? 0}\n`;
    report += `- **Cost:** $${diff.trace1.cost?.toFixed(4) ?? '0.0000'}\n\n`;
    
    report += `## Trace 2\n`;
    report += `- **ID:** ${diff.trace2.id}\n`;
    report += `- **Provider:** ${diff.trace2.provider}\n`;
    report += `- **Model:** ${diff.trace2.model}\n`;
    report += `- **Latency:** ${diff.trace2.latency}ms\n`;
    report += `- **Tokens:** ${diff.trace2.tokensUsed?.total ?? 0}\n`;
    report += `- **Cost:** $${diff.trace2.cost?.toFixed(4) ?? '0.0000'}\n\n`;
    
    report += `## Differences\n\n`;
    report += `| Metric | Difference |\n`;
    report += `|--------|------------|\n`;
    
    if (diff.differences.provider) {
      report += `| Provider | ${diff.trace1.provider} → ${diff.trace2.provider} |\n`;
    }
    
    if (diff.differences.model) {
      report += `| Model | ${diff.trace1.model} → ${diff.trace2.model} |\n`;
    }
    
    const latencySign = diff.differences.latencyDiff > 0 ? '+' : '';
    report += `| Latency | ${latencySign}${diff.differences.latencyDiff}ms |\n`;
    
    const tokensSign = diff.differences.tokensDiff > 0 ? '+' : '';
    report += `| Tokens | ${tokensSign}${diff.differences.tokensDiff} |\n`;
    
    const costSign = diff.differences.costDiff > 0 ? '+' : '';
    report += `| Cost | ${costSign}$${diff.differences.costDiff.toFixed(4)} |\n`;
    
    if (diff.differences.outputDiff) {
      report += `\n### Output Difference\n\n`;
      report += `**Trace 1 Output:**\n\`\`\`\n${diff.trace1.response?.content ?? ''}\n\`\`\`\n\n`;
      report += `**Trace 2 Output:**\n\`\`\`\n${diff.trace2.response?.content ?? ''}\n\`\`\`\n`;
    }
    
    return report;
  }
}

export interface TraceDiff {
  trace1: TraceEntry;
  trace2: TraceEntry;
  differences: {
    provider: boolean;
    model: boolean;
    latencyDiff: number;
    tokensDiff: number;
    costDiff: number;
    outputDiff: boolean;
  };
}
