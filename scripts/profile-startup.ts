#!/usr/bin/env bun
/**
 * Startup Performance Profiler
 * Measures app startup time and identifies bottlenecks
 */

import { spawn } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

interface StartupMetric {
  phase: string;
  duration: number;
  timestamp: number;
}

const metrics: StartupMetric[] = [];
let startTime = Date.now();

function recordMetric(phase: string) {
  const now = Date.now();
  metrics.push({
    phase,
    duration: now - startTime,
    timestamp: now
  });
  startTime = now;
}

async function profileStartup() {
  console.log('🚀 Profiling Electron startup...\n');
  
  const overallStart = Date.now();
  recordMetric('script-start');

  // Build the app first
  console.log('📦 Building application...');
  const buildStart = Date.now();
  
  const buildProcess = spawn('bun', ['run', 'build'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });

  await new Promise((resolve, reject) => {
    buildProcess.on('close', (code) => {
      if (code === 0) resolve(null);
      else reject(new Error(`Build failed with code ${code}`));
    });
  });

  const buildTime = Date.now() - buildStart;
  recordMetric('build-complete');
  console.log(`✓ Build completed in ${buildTime}ms\n`);

  // Launch electron with profiling
  console.log('⚡ Launching Electron with profiling...');
  const launchStart = Date.now();

  const electronProcess = spawn('electron', ['.'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DEBUG: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      ELECTRON_RUN_AS_NODE: '0'
    },
    stdio: 'pipe'
  });

  let appReadyTime = 0;
  let windowShownTime = 0;
  let firstPaintTime = 0;

  electronProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    console.log(output);

    // Detect startup phases
    if (output.includes('app.whenReady') && appReadyTime === 0) {
      appReadyTime = Date.now() - launchStart;
      console.log(`✓ App ready in ${appReadyTime}ms`);
    }
    if (output.includes('BrowserWindow') && windowShownTime === 0) {
      windowShownTime = Date.now() - launchStart;
      console.log(`✓ Window shown in ${windowShownTime}ms`);
    }
    if (output.includes('did-finish-load') && firstPaintTime === 0) {
      firstPaintTime = Date.now() - launchStart;
      console.log(`✓ First paint in ${firstPaintTime}ms`);
    }
  });

  electronProcess.stderr?.on('data', (data) => {
    console.error(data.toString());
  });

  // Wait for app to be ready (or timeout after 30s)
  await new Promise((resolve) => {
    setTimeout(() => {
      electronProcess.kill();
      resolve(null);
    }, 30000);
  });

  const totalStartupTime = Date.now() - launchStart;
  recordMetric('electron-exit');

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    totalStartupTime,
    buildTime,
    phases: {
      appReady: appReadyTime || 'not-detected',
      windowShown: windowShownTime || 'not-detected',
      firstPaint: firstPaintTime || 'not-detected'
    },
    metrics,
    recommendations: generateRecommendations({
      totalStartupTime,
      appReadyTime,
      windowShownTime,
      firstPaintTime
    })
  };

  // Save report
  const outputDir = join(process.cwd(), 'performance-reports');
  await mkdir(outputDir, { recursive: true });
  const reportPath = join(outputDir, `startup-profile-${Date.now()}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log('\n📊 Startup Profile Report:');
  console.log(`   Total time: ${totalStartupTime}ms`);
  console.log(`   Build time: ${buildTime}ms`);
  console.log(`   App ready: ${appReadyTime}ms`);
  console.log(`   Window shown: ${windowShownTime}ms`);
  console.log(`   First paint: ${firstPaintTime}ms`);
  console.log(`\n📁 Report saved to: ${reportPath}`);

  return report;
}

function generateRecommendations(metrics: any) {
  const recommendations = [];

  if (metrics.appReadyTime > 1000) {
    recommendations.push({
      severity: 'high',
      area: 'App Initialization',
      issue: 'App ready time exceeds 1s',
      suggestion: 'Defer non-critical initialization, lazy load services'
    });
  }

  if (metrics.windowShownTime > 2000) {
    recommendations.push({
      severity: 'high',
      area: 'Window Creation',
      issue: 'Window shown time exceeds 2s',
      suggestion: 'Optimize window creation, reduce preload script size'
    });
  }

  if (metrics.firstPaint > 3000) {
    recommendations.push({
      severity: 'high',
      area: 'Renderer Startup',
      issue: 'First paint time exceeds 3s',
      suggestion: 'Optimize bundle size, implement code splitting, reduce initial render'
    });
  }

  return recommendations;
}

// Run profiling
profileStartup().catch(console.error);
