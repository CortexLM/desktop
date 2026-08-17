#!/usr/bin/env bun
/**
 * IPC Performance Profiler
 * Measures IPC latency between main and renderer processes
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

interface IPCProfile {
  timestamp: string;
  channels: {
    name: string;
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    callCount: number;
    totalTime: number;
  }[];
  statistics: {
    totalChannels: number;
    avgLatency: number;
    maxLatency: number;
    slowChannels: number;
  };
  recommendations: any[];
}

async function profileIPC() {
  console.log('⚡ IPC Performance Profiling Guide\n');
  
  console.log('To profile IPC latency:');
  console.log('1. Enable IPC monitoring in the app:');
  console.log('   - Set DEBUG=true environment variable');
  console.log('   - IPC monitor is already initialized in main/index.ts');
  console.log('\n2. Use the app and trigger various IPC calls');
  console.log('\n3. Common IPC channels to test:');
  console.log('   - db:query (database queries)');
  console.log('   - ai:stream (AI streaming)');
  console.log('   - git:status (git operations)');
  console.log('   - terminal:create (terminal operations)');
  console.log('   - automation:run (automation execution)');
  console.log('\n4. Check IPC stats in the app console\n');

  // Create sample analysis with common patterns
  const sampleChannels = [
    {
      name: 'db:query',
      avgLatency: 5.2,
      minLatency: 2.1,
      maxLatency: 15.8,
      callCount: 150,
      totalTime: 780
    },
    {
      name: 'ai:stream',
      avgLatency: 120.5,
      minLatency: 80.0,
      maxLatency: 250.0,
      callCount: 25,
      totalTime: 3012.5
    },
    {
      name: 'git:status',
      avgLatency: 45.3,
      minLatency: 30.0,
      maxLatency: 120.0,
      callCount: 40,
      totalTime: 1812
    },
    {
      name: 'terminal:create',
      avgLatency: 35.0,
      minLatency: 25.0,
      maxLatency: 60.0,
      callCount: 10,
      totalTime: 350
    }
  ];

  const totalLatency = sampleChannels.reduce((sum, c) => sum + c.avgLatency * c.callCount, 0);
  const totalCalls = sampleChannels.reduce((sum, c) => sum + c.callCount, 0);
  const avgLatency = totalLatency / totalCalls;
  const maxLatency = Math.max(...sampleChannels.map(c => c.maxLatency));
  const slowChannels = sampleChannels.filter(c => c.avgLatency > 50).length;

  const profile: IPCProfile = {
    timestamp: new Date().toISOString(),
    channels: sampleChannels,
    statistics: {
      totalChannels: sampleChannels.length,
      avgLatency,
      maxLatency,
      slowChannels
    },
    recommendations: generateIPCRecommendations(sampleChannels)
  };

  // Save report
  const outputDir = join(process.cwd(), 'performance-reports');
  await mkdir(outputDir, { recursive: true });
  const reportPath = join(outputDir, 'ipc-profile-sample.json');
  await writeFile(reportPath, JSON.stringify(profile, null, 2));

  console.log('📊 Sample IPC Profile:');
  sampleChannels.forEach(channel => {
    const status = channel.avgLatency > 50 ? '⚠️' : '✓';
    console.log(`   ${status} ${channel.name}: ${channel.avgLatency.toFixed(2)}ms avg (${channel.callCount} calls)`);
  });

  console.log(`\n📁 Sample report saved to: ${reportPath}`);
  console.log('\n💡 IPC Optimization Tips:');
  console.log('   ✓ Batch multiple small requests into one');
  console.log('   ✓ Use SharedArrayBuffer for large data transfers');
  console.log('   ✓ Avoid frequent back-and-forth communication');
  console.log('   ✓ Cache results in renderer when possible');
  console.log('   ✓ Use streams for large data transfers');

  return profile;
}

function generateIPCRecommendations(channels: any[]) {
  const recommendations = [];

  const slowChannels = channels.filter(c => c.avgLatency > 50);
  if (slowChannels.length > 0) {
    recommendations.push({
      severity: 'high',
      area: 'IPC Latency',
      issue: `${slowChannels.length} channels exceed 50ms average latency`,
      channels: slowChannels.map(c => c.name),
      suggestion: 'Optimize slow IPC handlers, implement caching, or batch requests'
    });
  }

  const frequentChannels = channels.filter(c => c.callCount > 100);
  if (frequentChannels.length > 0) {
    recommendations.push({
      severity: 'medium',
      area: 'IPC Frequency',
      issue: `${frequentChannels.length} channels called > 100 times`,
      channels: frequentChannels.map(c => c.name),
      suggestion: 'Consider implementing a caching layer or reducing call frequency'
    });
  }

  const highVarianceChannels = channels.filter(c => (c.maxLatency / c.avgLatency) > 3);
  if (highVarianceChannels.length > 0) {
    recommendations.push({
      severity: 'medium',
      area: 'IPC Consistency',
      issue: `${highVarianceChannels.length} channels have high latency variance`,
      channels: highVarianceChannels.map(c => c.name),
      suggestion: 'Investigate intermittent slowdowns, possible resource contention'
    });
  }

  return recommendations;
}

profileIPC().catch(console.error);
