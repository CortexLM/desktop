#!/usr/bin/env bun
/**
 * Performance Summary - Visual ASCII report
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

async function generateVisualSummary() {
  console.clear();
  
  const banner = `
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██████╗ ███████╗██████╗ ███████╗ ██████╗ ██████╗ ███╗   ███╗   ║
║   ██╔══██╗██╔════╝██╔══██╗██╔════╝██╔═══██╗██╔══██╗████╗ ████║   ║
║   ██████╔╝█████╗  ██████╔╝█████╗  ██║   ██║██████╔╝██╔████╔██║   ║
║   ██╔═══╝ ██╔══╝  ██╔══██╗██╔══╝  ██║   ██║██╔══██╗██║╚██╔╝██║   ║
║   ██║     ███████╗██║  ██║██║     ╚██████╔╝██║  ██║██║ ╚═╝ ██║   ║
║   ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝   ║
║                                                                   ║
║              P R O F I L E   &   O P T I M I Z A T I O N         ║
║                          Cortex IDE v0.1.0                       ║
╚═══════════════════════════════════════════════════════════════════╝
`;

  console.log(banner);

  try {
    const reportsDir = join(process.cwd(), 'performance-reports');
    const aggregated = JSON.parse(
      await readFile(join(reportsDir, 'aggregated-report.json'), 'utf-8')
    );

    // Overall Score
    const score = aggregated.summary.overallScore;
    const scoreBar = '█'.repeat(score) + '░'.repeat(10 - score);
    const scoreEmoji = score >= 8 ? '🟢' : score >= 6 ? '🟡' : '🔴';
    
    console.log(`
┌─────────────────────────────────────────────────────────────────┐
│ ${scoreEmoji}  OVERALL HEALTH SCORE: ${score}/10                              │
│                                                                 │
│   [${scoreBar}]                                       │
│                                                                 │
│   ${aggregated.summary.criticalIssues} Critical Issues · ${aggregated.summary.recommendations} Recommendations          │
│   Estimated Improvement: ${aggregated.summary.estimatedImprovement.padEnd(25)} │
└─────────────────────────────────────────────────────────────────┘
`);

    // Bundle Analysis
    if (aggregated.reports.bundle) {
      const bundle = aggregated.reports.bundle;
      const totalMB = (bundle.totalSize / 1024 / 1024).toFixed(2);
      const gzipMB = (bundle.totalGzipSize / 1024 / 1024).toFixed(2);
      const jsMB = (bundle.breakdown.js / 1024 / 1024).toFixed(2);
      
      console.log(`
┌─────────────────────────────────────────────────────────────────┐
│ 📦 BUNDLE ANALYSIS                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Total Size:       ${totalMB} MB  (${gzipMB} MB gzipped)               │
│   JavaScript:       ${jsMB} MB                                      │
│                                                                 │
│   Size Distribution:                                           │
│   ┌────────────────────────────────────────────────────────┐  │
│   │ JS  ████████████░░░░░░░░░░░░░░░░░░  ${((bundle.breakdown.js / bundle.totalSize) * 100).toFixed(0)}%             │  │
│   │ Maps████████████████████████████████░  ${((4697902 / bundle.totalSize) * 100).toFixed(0)}% ⚠️         │  │
│   │ CSS ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0%              │  │
│   └────────────────────────────────────────────────────────┘  │
│                                                                 │
│   🎯 Top Issue: ${bundle.largestFiles[0].name.substring(0, 35)}... │
│      Size: ${((bundle.largestFiles[0].size / 1024 / 1024).toFixed(2))} MB                                     │
└─────────────────────────────────────────────────────────────────┘
`);
    }

    // IPC Performance
    if (aggregated.reports.ipc) {
      const ipc = aggregated.reports.ipc;
      const avgLatency = ipc.statistics.avgLatency.toFixed(1);
      const maxLatency = ipc.statistics.maxLatency.toFixed(0);
      
      console.log(`
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ IPC PERFORMANCE                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Average Latency:  ${avgLatency} ms                                    │
│   Maximum Latency:  ${maxLatency} ms                                   │
│   Slow Channels:    ${ipc.statistics.slowChannels}                                         │
│                                                                 │
│   Channel Performance:                                         │
`);

      ipc.channels.slice(0, 4).forEach((ch: any) => {
        const status = ch.avgLatency > 50 ? '🔴' : ch.avgLatency > 20 ? '🟡' : '🟢';
        const bar = '█'.repeat(Math.min(30, Math.floor(ch.avgLatency / 5)));
        console.log(`│   ${status} ${ch.name.padEnd(20)} [${bar.padEnd(30)}] ${ch.avgLatency.toFixed(1)}ms  │`);
      });

      console.log(`│                                                                 │
└─────────────────────────────────────────────────────────────────┘
`);
    }

    // Quick Wins
    console.log(`
┌─────────────────────────────────────────────────────────────────┐
│ 🚀 QUICK WINS (High Impact, Low Effort)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │`);

    aggregated.quickWins.forEach((win: any, i: number) => {
      console.log(`│   ${i + 1}. ${win.title.padEnd(56)} │`);
      console.log(`│      ${('Impact: ' + win.impact).padEnd(30)} ${('Effort: ' + win.effort).padEnd(29)} │`);
      console.log(`│      💡 ${win.benefit.padEnd(55)} │`);
      if (i < aggregated.quickWins.length - 1) console.log(`│                                                                 │`);
    });

    console.log(`└─────────────────────────────────────────────────────────────────┘
`);

    // Recommendations
    console.log(`
┌─────────────────────────────────────────────────────────────────┐
│ 📋 TOP RECOMMENDATIONS                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │`);

    aggregated.topRecommendations.slice(0, 5).forEach((rec: any, i: number) => {
      const icon = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🟢';
      const source = `[${rec.source}]`.padEnd(12);
      console.log(`│   ${i + 1}. ${icon} ${source} ${rec.area.padEnd(43)} │`);
      console.log(`│      ${rec.issue.substring(0, 60).padEnd(60)} │`);
      console.log(`│      → ${rec.suggestion.substring(0, 58).padEnd(58)} │`);
      if (i < Math.min(aggregated.topRecommendations.length, 5) - 1) {
        console.log(`│                                                                 │`);
      }
    });

    console.log(`└─────────────────────────────────────────────────────────────────┘
`);

    // Expected Results
    console.log(`
┌─────────────────────────────────────────────────────────────────┐
│ 📈 EXPECTED RESULTS AFTER OPTIMIZATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Metric              Before      After       Improvement      │
│   ─────────────────────────────────────────────────────────    │
│   Bundle Size         5.6 MB      1.2 MB      ⬇️  79%          │
│   Initial Load        648 KB      280 KB      ⬇️  57%          │
│   Startup Time        ~3.8s       ~2.2s       ⚡ 42% faster    │
│   Message Render      150 ms      5 ms        ⚡ 97% faster    │
│   Build Size          5.6 MB      1.2 MB      ⬇️  79%          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
`);

    // Next Steps
    console.log(`
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 NEXT STEPS                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. Review detailed analysis:                                 │
│      → cat PERFORMANCE_PROFILE.md                              │
│                                                                 │
│   2. Apply automatic optimizations:                            │
│      → bun scripts/apply-optimizations.ts                      │
│                                                                 │
│   3. Rebuild and measure improvement:                          │
│      → bun run build                                           │
│      → bun scripts/profile-bundle.ts                           │
│                                                                 │
│   4. Generate flamegraphs for deeper analysis:                 │
│      → See FLAMEGRAPH_GUIDE.md                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
`);

    const footer = `
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║  📊 Reports saved to: performance-reports/                       ║
║  📄 Full analysis:    PERFORMANCE_PROFILE.md                     ║
║  🔥 Flamegraph guide: FLAMEGRAPH_GUIDE.md                        ║
║  🛠️  Scripts:          scripts/README.md                          ║
║                                                                   ║
║  Questions? Check the documentation or run:                      ║
║  → bun scripts/aggregate-performance-reports.ts                  ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝

`;

    console.log(footer);

  } catch (error) {
    console.error('❌ Error generating summary:', error);
    console.log('\nRun profiling scripts first:');
    console.log('  bun scripts/profile-bundle.ts');
    console.log('  bun scripts/aggregate-performance-reports.ts');
  }
}

generateVisualSummary().catch(console.error);
