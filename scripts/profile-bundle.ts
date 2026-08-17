#!/usr/bin/env bun
/**
 * Bundle Analysis Script
 * Analyzes webpack/vite bundle size and composition
 */

import { readdir, stat, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { gzipSync } from 'zlib';

interface BundleFile {
  name: string;
  path: string;
  size: number;
  gzipSize: number;
  type: 'js' | 'css' | 'asset' | 'other';
}

interface BundleAnalysis {
  timestamp: string;
  totalSize: number;
  totalGzipSize: number;
  files: BundleFile[];
  breakdown: {
    js: number;
    css: number;
    assets: number;
    other: number;
  };
  largestFiles: BundleFile[];
  recommendations: any[];
}

async function analyzeBundles() {
  console.log('📦 Analyzing bundle sizes...\n');

  const distDirs = [
    'packages/renderer/dist',
    'packages/main/dist',
    'packages/preload/dist'
  ];

  const allFiles: BundleFile[] = [];

  for (const distDir of distDirs) {
    const dirPath = join(process.cwd(), distDir);
    try {
      const files = await analyzeDirectory(dirPath, distDir);
      allFiles.push(...files);
    } catch (error) {
      console.warn(`⚠️  Could not analyze ${distDir}:`, error);
    }
  }

  // Calculate totals
  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
  const totalGzipSize = allFiles.reduce((sum, f) => sum + f.gzipSize, 0);

  // Breakdown by type
  const breakdown = {
    js: allFiles.filter(f => f.type === 'js').reduce((sum, f) => sum + f.size, 0),
    css: allFiles.filter(f => f.type === 'css').reduce((sum, f) => sum + f.size, 0),
    assets: allFiles.filter(f => f.type === 'asset').reduce((sum, f) => sum + f.size, 0),
    other: allFiles.filter(f => f.type === 'other').reduce((sum, f) => sum + f.size, 0)
  };

  // Sort by size
  const largestFiles = [...allFiles].sort((a, b) => b.size - a.size).slice(0, 20);

  const analysis: BundleAnalysis = {
    timestamp: new Date().toISOString(),
    totalSize,
    totalGzipSize,
    files: allFiles,
    breakdown,
    largestFiles,
    recommendations: generateBundleRecommendations(allFiles, breakdown)
  };

  // Save report
  const outputDir = join(process.cwd(), 'performance-reports');
  await mkdir(outputDir, { recursive: true });
  const reportPath = join(outputDir, `bundle-analysis-${Date.now()}.json`);
  await writeFile(reportPath, JSON.stringify(analysis, null, 2));

  // Print summary
  console.log('📊 Bundle Analysis:');
  console.log(`   Total size: ${formatBytes(totalSize)} (${formatBytes(totalGzipSize)} gzipped)`);
  console.log(`   JavaScript: ${formatBytes(breakdown.js)}`);
  console.log(`   CSS: ${formatBytes(breakdown.css)}`);
  console.log(`   Assets: ${formatBytes(breakdown.assets)}`);
  console.log(`   Other: ${formatBytes(breakdown.other)}`);
  console.log('\n🗂️  Largest files:');
  largestFiles.slice(0, 10).forEach((file, i) => {
    console.log(`   ${i + 1}. ${file.name} - ${formatBytes(file.size)} (${formatBytes(file.gzipSize)} gzipped)`);
  });
  console.log(`\n📁 Report saved to: ${reportPath}`);

  return analysis;
}

async function analyzeDirectory(dirPath: string, basePath: string): Promise<BundleFile[]> {
  const files: BundleFile[] = [];
  const entries = await readdir(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      const subFiles = await analyzeDirectory(fullPath, basePath);
      files.push(...subFiles);
    } else if (stats.isFile()) {
      const content = await readFile(fullPath);
      const gzipSize = gzipSync(content).length;
      const ext = entry.split('.').pop() || '';
      
      let type: BundleFile['type'] = 'other';
      if (['js', 'mjs', 'cjs'].includes(ext)) type = 'js';
      else if (ext === 'css') type = 'css';
      else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'woff', 'woff2', 'ttf'].includes(ext)) type = 'asset';

      files.push({
        name: entry,
        path: fullPath.replace(process.cwd() + '/', ''),
        size: stats.size,
        gzipSize,
        type
      });
    }
  }

  return files;
}

function generateBundleRecommendations(files: BundleFile[], breakdown: any) {
  const recommendations = [];

  // Check for large JS files
  const largeJsFiles = files.filter(f => f.type === 'js' && f.size > 500 * 1024);
  if (largeJsFiles.length > 0) {
    recommendations.push({
      severity: 'high',
      area: 'JavaScript Bundle',
      issue: `${largeJsFiles.length} JS file(s) exceed 500KB`,
      files: largeJsFiles.map(f => ({ name: f.name, size: formatBytes(f.size) })),
      suggestion: 'Implement code splitting, lazy loading, or tree shaking'
    });
  }

  // Check total JS size
  if (breakdown.js > 2 * 1024 * 1024) {
    recommendations.push({
      severity: 'medium',
      area: 'Total JavaScript Size',
      issue: `Total JS size exceeds 2MB (${formatBytes(breakdown.js)})`,
      suggestion: 'Review dependencies, remove unused code, implement dynamic imports'
    });
  }

  // Check for duplicate vendors
  const vendorFiles = files.filter(f => f.name.includes('vendor'));
  if (vendorFiles.length > 3) {
    recommendations.push({
      severity: 'medium',
      area: 'Vendor Splitting',
      issue: `Multiple vendor bundles detected (${vendorFiles.length})`,
      suggestion: 'Optimize vendor chunk splitting strategy'
    });
  }

  return recommendations;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Run analysis
analyzeBundles().catch(console.error);
