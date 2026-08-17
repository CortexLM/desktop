import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { BenchmarkResult, TestResult } from '../types.js';

export class ReportGenerator {
  async generateJSON(result: BenchmarkResult, outputPath: string): Promise<void> {
    await mkdir(outputPath, { recursive: true });
    const filePath = join(outputPath, `benchmark-${result.benchmarkId}.json`);
    await writeFile(filePath, JSON.stringify(result, null, 2));
    console.log(`📄 JSON report saved to: ${filePath}`);
  }
  
  async generateMarkdown(result: BenchmarkResult, outputPath: string): Promise<void> {
    await mkdir(outputPath, { recursive: true });
    const filePath = join(outputPath, `benchmark-${result.benchmarkId}.md`);
    
    const md = this.buildMarkdownReport(result);
    await writeFile(filePath, md);
    console.log(`📄 Markdown report saved to: ${filePath}`);
  }
  
  async generateHTML(result: BenchmarkResult, outputPath: string): Promise<void> {
    await mkdir(outputPath, { recursive: true });
    const filePath = join(outputPath, `benchmark-${result.benchmarkId}.html`);
    
    const html = this.buildHTMLReport(result);
    await writeFile(filePath, html);
    console.log(`📄 HTML report saved to: ${filePath}`);
  }
  
  private buildMarkdownReport(result: BenchmarkResult): string {
    const { benchmarkName, description, summary, results, timestamp } = result;
    
    let md = `# ${benchmarkName}\n\n`;
    md += `**Description:** ${description}\n\n`;
    md += `**Date:** ${new Date(timestamp).toISOString()}\n\n`;
    md += `## Summary\n\n`;
    md += `- **Total Tests:** ${summary.totalTests}\n`;
    md += `- **Successful:** ${summary.successfulTests}\n`;
    md += `- **Failed:** ${summary.failedTests}\n`;
    md += `- **Duration:** ${(summary.totalDuration / 1000).toFixed(2)}s\n`;
    md += `- **Total Cost:** $${summary.totalCost.toFixed(4)}\n\n`;
    
    // Group by provider
    const byProvider = this.groupByProvider(results);
    
    md += `## Results by Provider\n\n`;
    
    for (const [provider, providerResults] of Object.entries(byProvider)) {
      md += `### ${provider.toUpperCase()}\n\n`;
      
      const providerStats = this.calculateProviderStats(providerResults);
      
      md += `| Metric | Value |\n`;
      md += `|--------|-------|\n`;
      md += `| Success Rate | ${(providerStats.successRate * 100).toFixed(1)}% |\n`;
      md += `| Avg Latency | ${providerStats.avgLatency.toFixed(0)}ms |\n`;
      md += `| Total Tokens | ${providerStats.totalTokens.toLocaleString()} |\n`;
      md += `| Total Cost | $${providerStats.totalCost.toFixed(4)} |\n\n`;
      
      md += `#### Test Results\n\n`;
      md += `| Test | Status | Latency | Tokens | Cost |\n`;
      md += `|------|--------|---------|--------|------|\n`;
      
      for (const test of providerResults) {
        const latency = test.metrics.averageLatency.toFixed(0);
        const tokens = test.metrics.totalTokens.toLocaleString();
        const cost = test.metrics.totalCost.toFixed(4);
        const status = test.status === 'success' ? '✅' : '❌';
        
        md += `| ${test.testName} | ${status} ${test.status} | ${latency}ms | ${tokens} | $${cost} |\n`;
      }
      
      md += `\n`;
    }
    
    // Comparison table
    md += `## Provider Comparison\n\n`;
    md += `| Provider | Success Rate | Avg Latency | Total Cost | Total Tokens |\n`;
    md += `|----------|--------------|-------------|------------|-------------|\n`;
    
    for (const [provider, providerResults] of Object.entries(byProvider)) {
      const stats = this.calculateProviderStats(providerResults);
      md += `| ${provider} | ${(stats.successRate * 100).toFixed(1)}% | ${stats.avgLatency.toFixed(0)}ms | $${stats.totalCost.toFixed(4)} | ${stats.totalTokens.toLocaleString()} |\n`;
    }
    
    return md;
  }
  
  private buildHTMLReport(result: BenchmarkResult): string {
    const { benchmarkName, description, summary, results, timestamp } = result;
    const byProvider = this.groupByProvider(results);
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${benchmarkName} - Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2rem; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 0.5rem; }
    .description { color: #666; margin-bottom: 2rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .summary-card { background: #f9f9f9; padding: 1rem; border-radius: 4px; border-left: 4px solid #4CAF50; }
    .summary-card.failed { border-left-color: #f44336; }
    .summary-card h3 { font-size: 0.875rem; color: #666; margin-bottom: 0.5rem; }
    .summary-card .value { font-size: 1.5rem; font-weight: bold; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; color: #333; }
    tr:hover { background: #fafafa; }
    .provider-section { margin-bottom: 3rem; }
    .provider-title { color: #333; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #4CAF50; }
    .status { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem; font-weight: 500; }
    .status.success { background: #e8f5e9; color: #2e7d32; }
    .status.failure { background: #ffebee; color: #c62828; }
    .status.timeout { background: #fff3e0; color: #e65100; }
    .status.error { background: #fce4ec; color: #ad1457; }
    .chart { margin: 2rem 0; }
    .bar { display: flex; align-items: center; margin-bottom: 0.5rem; }
    .bar-label { min-width: 120px; font-size: 0.875rem; }
    .bar-fill { height: 24px; background: linear-gradient(90deg, #4CAF50, #8BC34A); border-radius: 4px; display: flex; align-items: center; padding: 0 0.5rem; color: white; font-size: 0.75rem; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${benchmarkName}</h1>
    <p class="description">${description}</p>
    <p style="color: #999; font-size: 0.875rem; margin-bottom: 2rem;">${new Date(timestamp).toLocaleString()}</p>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Total Tests</h3>
        <div class="value">${summary.totalTests}</div>
      </div>
      <div class="summary-card">
        <h3>Successful</h3>
        <div class="value">${summary.successfulTests}</div>
      </div>
      <div class="summary-card failed">
        <h3>Failed</h3>
        <div class="value">${summary.failedTests}</div>
      </div>
      <div class="summary-card">
        <h3>Duration</h3>
        <div class="value">${(summary.totalDuration / 1000).toFixed(1)}s</div>
      </div>
      <div class="summary-card">
        <h3>Total Cost</h3>
        <div class="value">$${summary.totalCost.toFixed(4)}</div>
      </div>
    </div>
    
    <h2>Provider Comparison</h2>
    <div class="chart">`;
    
    for (const [provider, providerResults] of Object.entries(byProvider)) {
      const stats = this.calculateProviderStats(providerResults);
      const width = stats.successRate * 100;
      
      html += `
      <div class="bar">
        <div class="bar-label">${provider}</div>
        <div class="bar-fill" style="width: ${width}%">${(stats.successRate * 100).toFixed(1)}%</div>
      </div>`;
    }
    
    html += `
    </div>
    
    <table>
      <thead>
        <tr>
          <th>Provider</th>
          <th>Success Rate</th>
          <th>Avg Latency</th>
          <th>Total Cost</th>
          <th>Total Tokens</th>
        </tr>
      </thead>
      <tbody>`;
    
    for (const [provider, providerResults] of Object.entries(byProvider)) {
      const stats = this.calculateProviderStats(providerResults);
      html += `
        <tr>
          <td><strong>${provider}</strong></td>
          <td>${(stats.successRate * 100).toFixed(1)}%</td>
          <td>${stats.avgLatency.toFixed(0)}ms</td>
          <td>$${stats.totalCost.toFixed(4)}</td>
          <td>${stats.totalTokens.toLocaleString()}</td>
        </tr>`;
    }
    
    html += `
      </tbody>
    </table>`;
    
    // Detailed results per provider
    for (const [provider, providerResults] of Object.entries(byProvider)) {
      html += `
    <div class="provider-section">
      <h2 class="provider-title">${provider.toUpperCase()} - Detailed Results</h2>
      <table>
        <thead>
          <tr>
            <th>Test Name</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Latency</th>
            <th>Tokens</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>`;
      
      for (const test of providerResults) {
        html += `
          <tr>
            <td>${test.testName}</td>
            <td><span class="status ${test.status}">${test.status}</span></td>
            <td>${(test.duration / 1000).toFixed(2)}s</td>
            <td>${test.metrics.averageLatency.toFixed(0)}ms</td>
            <td>${test.metrics.totalTokens.toLocaleString()}</td>
            <td>$${test.metrics.totalCost.toFixed(4)}</td>
          </tr>`;
      }
      
      html += `
        </tbody>
      </table>
    </div>`;
    }
    
    html += `
  </div>
</body>
</html>`;
    
    return html;
  }
  
  private groupByProvider(results: TestResult[]): Record<string, TestResult[]> {
    const grouped: Record<string, TestResult[]> = {};
    
    for (const result of results) {
      if (!grouped[result.provider]) {
        grouped[result.provider] = [];
      }
      grouped[result.provider].push(result);
    }
    
    return grouped;
  }
  
  private calculateProviderStats(results: TestResult[]): {
    successRate: number;
    avgLatency: number;
    totalCost: number;
    totalTokens: number;
  } {
    const successCount = results.filter(r => r.status === 'success').length;
    const successRate = successCount / results.length;
    const avgLatency = results.reduce((sum, r) => sum + r.metrics.averageLatency, 0) / results.length;
    const totalCost = results.reduce((sum, r) => sum + r.metrics.totalCost, 0);
    const totalTokens = results.reduce((sum, r) => sum + r.metrics.totalTokens, 0);
    
    return { successRate, avgLatency, totalCost, totalTokens };
  }
}
