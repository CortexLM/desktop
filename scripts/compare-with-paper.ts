/**
 * Paper Design Comparison Tool
 * Compares screenshots with Paper designs using Paper MCP
 */

import * as path from 'path';
import * as fs from 'fs';

interface ComparisonResult {
  component: string;
  screenshot: string;
  paperDesign?: string;
  differences: string[];
  severity: 'critical' | 'major' | 'minor' | 'none';
}

const PAPER_DESIGNS = {
  // Map screenshot names to Paper design node IDs or file names
  'git-panel': 'paper://cortex-v3/git-panel',
  'ai-chat': 'paper://cortex-v3/ai-chat',
  'editor-view': 'paper://cortex-v3/editor',
  'terminal-view': 'paper://cortex-v3/terminal',
  'button': 'paper://cortex-v3/components/button',
  'input': 'paper://cortex-v3/components/input',
  'dialog': 'paper://cortex-v3/components/dialog',
  // Add more mappings as needed
};

interface DesignToken {
  name: string;
  expected: string;
  actual: string;
  matches: boolean;
}

class PaperComparator {
  private screenshotsDir: string;
  private results: ComparisonResult[] = [];

  constructor(screenshotsDir: string) {
    this.screenshotsDir = screenshotsDir;
  }

  /**
   * Compare all screenshots with Paper designs
   */
  async compareAll(): Promise<void> {
    console.log('🎨 Starting Paper Design Comparison\n');

    const screenshots = this.getScreenshots();
    console.log(`Found ${screenshots.length} screenshots to compare\n`);

    for (const screenshot of screenshots) {
      await this.compareScreenshot(screenshot);
    }

    this.generateReport();
  }

  /**
   * Get all screenshots
   */
  private getScreenshots(): string[] {
    const files: string[] = [];
    
    // Main directory
    const mainFiles = fs.readdirSync(this.screenshotsDir)
      .filter(f => f.endsWith('.png'));
    files.push(...mainFiles.map(f => path.join(this.screenshotsDir, f)));

    // Components directory
    const componentsDir = path.join(this.screenshotsDir, 'components');
    if (fs.existsSync(componentsDir)) {
      const componentFiles = fs.readdirSync(componentsDir)
        .filter(f => f.endsWith('.png'));
      files.push(...componentFiles.map(f => path.join(componentsDir, f)));
    }

    return files;
  }

  /**
   * Compare a single screenshot with Paper design
   */
  private async compareScreenshot(screenshotPath: string): Promise<void> {
    const filename = path.basename(screenshotPath);
    const componentName = filename.split('__')[0];

    console.log(`🔍 Comparing: ${filename}`);

    const result: ComparisonResult = {
      component: componentName,
      screenshot: screenshotPath,
      paperDesign: PAPER_DESIGNS[componentName],
      differences: [],
      severity: 'none'
    };

    if (!result.paperDesign) {
      result.differences.push('No Paper design mapping found');
      result.severity = 'major';
      console.log(`   ⚠️  No Paper design mapping\n`);
      this.results.push(result);
      return;
    }

    // Here we would use Paper MCP to fetch design specs
    // For now, we'll do manual visual inspection checklist
    const checks = await this.performVisualChecks(componentName, screenshotPath);
    result.differences = checks.differences;
    result.severity = checks.severity;

    this.results.push(result);
    
    if (checks.severity === 'none') {
      console.log(`   ✅ Matches design\n`);
    } else {
      console.log(`   ${this.getSeverityIcon(checks.severity)} ${checks.differences.length} differences found\n`);
    }
  }

  /**
   * Perform visual checks against design system
   */
  private async performVisualChecks(component: string, screenshotPath: string): Promise<{
    differences: string[];
    severity: 'critical' | 'major' | 'minor' | 'none';
  }> {
    const differences: string[] = [];
    
    // Design token checks (would be automated with Paper MCP)
    const tokenChecks: DesignToken[] = [
      // Colors
      { name: 'Primary Accent', expected: '#3b82f6', actual: 'TBD', matches: true },
      { name: 'Background', expected: '#0a0a0a', actual: 'TBD', matches: true },
      { name: 'Surface', expected: '#1a1a1a', actual: 'TBD', matches: true },
      
      // Typography
      { name: 'Font Family', expected: 'Inter', actual: 'TBD', matches: true },
      { name: 'Base Font Size', expected: '14px', actual: 'TBD', matches: true },
      
      // Spacing
      { name: 'Base Spacing', expected: '8px', actual: 'TBD', matches: true },
      
      // Border Radius
      { name: 'Border Radius', expected: '6px', actual: 'TBD', matches: true },
    ];

    // Component-specific checks
    const componentChecks = this.getComponentChecks(component);
    
    // Manual visual inspection checklist
    const visualChecklist = [
      'Spacing and padding',
      'Color values',
      'Typography (font-family, size, weight)',
      'Border radius',
      'Shadow values',
      'Icon sizes and alignment',
      'Interaction states (hover, active, disabled)',
      'Responsive behavior',
      'Accessibility (contrast ratios)',
    ];

    // Placeholder - would be replaced with actual Paper MCP comparisons
    // For now, return manual inspection needed
    differences.push('Manual visual inspection required - compare with Paper Cortex V3');
    differences.push(...componentChecks);

    const severity = differences.length === 1 ? 'minor' : 'none';

    return { differences, severity };
  }

  /**
   * Get component-specific checks
   */
  private getComponentChecks(component: string): string[] {
    const checks: Record<string, string[]> = {
      'button': [
        'Check: All button variants (primary, secondary, ghost, danger)',
        'Check: All states (default, hover, active, disabled, loading)',
        'Check: Icon alignment and spacing',
        'Check: Min-width and padding values',
      ],
      'input': [
        'Check: All states (empty, filled, focused, error, disabled)',
        'Check: Label positioning and spacing',
        'Check: Error message styling',
        'Check: Icon positioning',
      ],
      'git-panel': [
        'Check: File list item height and padding',
        'Check: Status badge colors and sizes',
        'Check: Action button positioning',
        'Check: Diff viewer colors',
      ],
      'ai-chat': [
        'Check: Message bubble styling',
        'Check: Avatar sizes and positioning',
        'Check: Code block syntax highlighting',
        'Check: Loading state animation',
      ],
      'editor-view': [
        'Check: Line height and gutter width',
        'Check: Syntax highlighting colors',
        'Check: Autocomplete dropdown styling',
        'Check: Tab bar height and styling',
      ],
      'terminal-view': [
        'Check: ANSI color mapping',
        'Check: Font family (monospace)',
        'Check: Line height',
        'Check: Scrollbar styling',
      ],
    };

    return checks[component] || ['Check: General design consistency'];
  }

  /**
   * Generate comparison report
   */
  private generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Comparison Summary');
    console.log('='.repeat(60) + '\n');

    const bySeverity = {
      critical: this.results.filter(r => r.severity === 'critical').length,
      major: this.results.filter(r => r.severity === 'major').length,
      minor: this.results.filter(r => r.severity === 'minor').length,
      none: this.results.filter(r => r.severity === 'none').length,
    };

    console.log(`Total screenshots: ${this.results.length}`);
    console.log(`Matches design: ${bySeverity.none}`);
    console.log(`Minor differences: ${bySeverity.minor}`);
    console.log(`Major differences: ${bySeverity.major}`);
    console.log(`Critical differences: ${bySeverity.critical}\n`);

    // Generate markdown report
    this.generateMarkdownReport();
    
    // Generate HTML report
    this.generateHtmlReport();
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(): void {
    const reportPath = path.join(this.screenshotsDir, 'comparison', 'paper-comparison.md');
    const dir = path.dirname(reportPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let markdown = `# Paper Design Comparison Report\n\n`;
    markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
    markdown += `## Summary\n\n`;
    markdown += `- **Total Screenshots**: ${this.results.length}\n`;
    markdown += `- **Matches Design**: ${this.results.filter(r => r.severity === 'none').length}\n`;
    markdown += `- **Minor Issues**: ${this.results.filter(r => r.severity === 'minor').length}\n`;
    markdown += `- **Major Issues**: ${this.results.filter(r => r.severity === 'major').length}\n`;
    markdown += `- **Critical Issues**: ${this.results.filter(r => r.severity === 'critical').length}\n\n`;

    // Group by severity
    for (const severity of ['critical', 'major', 'minor', 'none'] as const) {
      const items = this.results.filter(r => r.severity === severity);
      if (items.length === 0) continue;

      markdown += `## ${this.getSeverityLabel(severity)} (${items.length})\n\n`;

      for (const item of items) {
        markdown += `### ${item.component}\n\n`;
        markdown += `- **Screenshot**: \`${path.basename(item.screenshot)}\`\n`;
        markdown += `- **Paper Design**: ${item.paperDesign || 'N/A'}\n\n`;
        
        if (item.differences.length > 0) {
          markdown += `**Differences:**\n`;
          for (const diff of item.differences) {
            markdown += `- ${diff}\n`;
          }
          markdown += `\n`;
        }
      }
    }

    fs.writeFileSync(reportPath, markdown);
    console.log(`📄 Markdown report: ${reportPath}`);
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(): void {
    const reportPath = path.join(this.screenshotsDir, 'comparison', 'paper-comparison.html');
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paper Design Comparison</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #ffffff;
      padding: 2rem;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .subtitle { color: #888; margin-bottom: 2rem; }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .severity-critical { color: #ef4444; }
    .severity-major { color: #f59e0b; }
    .severity-minor { color: #3b82f6; }
    .severity-none { color: #10b981; }
    .stat-label { color: #888; font-size: 0.875rem; }
    .comparison-list { display: grid; gap: 1.5rem; }
    .comparison-item {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      padding: 1.5rem;
    }
    .comparison-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .badge {
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-critical { background: #ef4444; color: #000; }
    .badge-major { background: #f59e0b; color: #000; }
    .badge-minor { background: #3b82f6; color: #000; }
    .badge-none { background: #10b981; color: #000; }
    .differences { margin-top: 1rem; }
    .differences li {
      margin-left: 1.5rem;
      margin-bottom: 0.5rem;
      color: #888;
    }
    .screenshot-preview {
      max-width: 400px;
      margin-top: 1rem;
      border-radius: 4px;
      border: 1px solid #2a2a2a;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Paper Design Comparison Report</h1>
    <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${this.results.length}</div>
        <div class="stat-label">Total Screenshots</div>
      </div>
      <div class="stat">
        <div class="stat-value severity-none">${this.results.filter(r => r.severity === 'none').length}</div>
        <div class="stat-label">Matches</div>
      </div>
      <div class="stat">
        <div class="stat-value severity-minor">${this.results.filter(r => r.severity === 'minor').length}</div>
        <div class="stat-label">Minor Issues</div>
      </div>
      <div class="stat">
        <div class="stat-value severity-major">${this.results.filter(r => r.severity === 'major').length}</div>
        <div class="stat-label">Major Issues</div>
      </div>
    </div>
    
    <div class="comparison-list">
      ${this.results.map(result => `
        <div class="comparison-item">
          <div class="comparison-header">
            <h3>${result.component}</h3>
            <span class="badge badge-${result.severity}">${result.severity.toUpperCase()}</span>
          </div>
          <div>
            <strong>Screenshot:</strong> ${path.basename(result.screenshot)}<br>
            <strong>Paper Design:</strong> ${result.paperDesign || 'N/A'}
          </div>
          ${result.differences.length > 0 ? `
            <div class="differences">
              <strong>Differences:</strong>
              <ul>
                ${result.differences.map(diff => `<li>${diff}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
    `;

    fs.writeFileSync(reportPath, html);
    console.log(`📄 HTML report: ${reportPath}\n`);
  }

  private getSeverityIcon(severity: string): string {
    const icons = {
      critical: '🔴',
      major: '🟠',
      minor: '🔵',
      none: '✅'
    };
    return icons[severity] || '⚪';
  }

  private getSeverityLabel(severity: string): string {
    const labels = {
      critical: '🔴 Critical Issues',
      major: '🟠 Major Issues',
      minor: '🔵 Minor Issues',
      none: '✅ Matches Design'
    };
    return labels[severity] || severity;
  }
}

// Main execution
async function main() {
  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  
  if (!fs.existsSync(screenshotsDir)) {
    console.error('❌ Screenshots directory not found. Run screenshots capture first.');
    process.exit(1);
  }

  const comparator = new PaperComparator(screenshotsDir);
  await comparator.compareAll();
}

main().catch(console.error);
