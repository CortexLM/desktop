#!/usr/bin/env bun

/**
 * Automated Screenshot Capture Script
 * Launches the app and captures all visual states
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');
const DELAY_BETWEEN_CAPTURES = 1000; // ms

interface CaptureConfig {
  outputDir: string;
  themes: Array<'light' | 'dark'>;
  viewports: Array<{ name: string; width: number; height: number }>;
  parallel: boolean;
}

const DEFAULT_CONFIG: CaptureConfig = {
  outputDir: SCREENSHOTS_DIR,
  themes: ['dark', 'light'],
  viewports: [
    { name: 'desktop', width: 1400, height: 900 },
    { name: 'laptop', width: 1280, height: 720 },
    { name: 'wide', width: 1920, height: 1080 }
  ],
  parallel: false
};

/**
 * Setup directories
 */
function setupDirectories(config: CaptureConfig) {
  const dirs = [
    config.outputDir,
    path.join(config.outputDir, 'components'),
    path.join(config.outputDir, 'views'),
    path.join(config.outputDir, 'storybook'),
    path.join(config.outputDir, 'comparison')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  }
}

/**
 * Run Playwright tests
 */
async function runPlaywrightTests(testFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Running tests: ${testFile}`);
    
    const playwright = spawn('bun', ['playwright', 'test', testFile, '--reporter=list'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        CI: 'false'
      }
    });

    playwright.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Tests completed: ${testFile}`);
        resolve();
      } else {
        console.error(`❌ Tests failed: ${testFile} (exit code ${code})`);
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });

    playwright.on('error', (err) => {
      console.error(`❌ Failed to start Playwright: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Generate HTML report
 */
function generateHtmlReport(config: CaptureConfig) {
  const screenshotFiles = fs.readdirSync(config.outputDir)
    .filter(f => f.endsWith('.png'))
    .sort();

  const componentFiles = fs.existsSync(path.join(config.outputDir, 'components'))
    ? fs.readdirSync(path.join(config.outputDir, 'components')).filter(f => f.endsWith('.png')).sort()
    : [];

  const storybookFiles = fs.existsSync(path.join(config.outputDir, 'storybook'))
    ? fs.readdirSync(path.join(config.outputDir, 'storybook')).filter(f => f.endsWith('.png')).sort()
    : [];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cortex IDE - Visual Regression Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #ffffff;
      padding: 2rem;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    
    .subtitle {
      color: #888;
      margin-bottom: 2rem;
    }
    
    .section {
      margin-bottom: 3rem;
    }
    
    h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #2a2a2a;
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 1.5rem;
      margin-top: 1.5rem;
    }
    
    .screenshot-card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .screenshot-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }
    
    .screenshot-card img {
      width: 100%;
      display: block;
      cursor: pointer;
    }
    
    .screenshot-info {
      padding: 1rem;
    }
    
    .screenshot-name {
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.25rem;
    }
    
    .screenshot-meta {
      font-size: 0.75rem;
      color: #888;
    }
    
    .stats {
      display: flex;
      gap: 2rem;
      padding: 1.5rem;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    
    .stat {
      text-align: center;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #3b82f6;
    }
    
    .stat-label {
      font-size: 0.875rem;
      color: #888;
      margin-top: 0.25rem;
    }
    
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      padding: 2rem;
      overflow: auto;
    }
    
    .modal.active {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .modal img {
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
    }
    
    .modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      font-size: 2rem;
      color: white;
      cursor: pointer;
      background: #1a1a1a;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
    }
    
    .filter-bar {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    
    .filter-btn {
      padding: 0.5rem 1rem;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 4px;
      color: #888;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.2s;
    }
    
    .filter-btn:hover {
      border-color: #3b82f6;
      color: #3b82f6;
    }
    
    .filter-btn.active {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Cortex IDE - Visual Regression Report</h1>
    <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${screenshotFiles.length + componentFiles.length + storybookFiles.length}</div>
        <div class="stat-label">Total Screenshots</div>
      </div>
      <div class="stat">
        <div class="stat-value">${screenshotFiles.length}</div>
        <div class="stat-label">App Views</div>
      </div>
      <div class="stat">
        <div class="stat-value">${componentFiles.length}</div>
        <div class="stat-label">Components</div>
      </div>
      <div class="stat">
        <div class="stat-value">${storybookFiles.length}</div>
        <div class="stat-label">Storybook</div>
      </div>
    </div>
    
    <div class="filter-bar">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="dark">Dark Theme</button>
      <button class="filter-btn" data-filter="light">Light Theme</button>
      <button class="filter-btn" data-filter="desktop">Desktop</button>
      <button class="filter-btn" data-filter="mobile">Mobile</button>
    </div>
    
    ${screenshotFiles.length > 0 ? `
    <section class="section">
      <h2>Application Views (${screenshotFiles.length})</h2>
      <div class="grid">
        ${screenshotFiles.map(file => {
          const parts = file.replace('.png', '').split('__');
          return `
            <div class="screenshot-card" data-theme="${parts[1] || 'unknown'}" data-viewport="${parts[3] || 'unknown'}">
              <img src="${file}" alt="${file}" onclick="openModal(this.src)">
              <div class="screenshot-info">
                <div class="screenshot-name">${parts[0] || file}</div>
                <div class="screenshot-meta">Theme: ${parts[1] || 'N/A'} | State: ${parts[2] || 'N/A'} | ${parts[3] || 'N/A'}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
    ` : ''}
    
    ${componentFiles.length > 0 ? `
    <section class="section">
      <h2>Component Library (${componentFiles.length})</h2>
      <div class="grid">
        ${componentFiles.map(file => {
          const parts = file.replace('.png', '').split('__');
          return `
            <div class="screenshot-card" data-theme="${parts[1] || 'unknown'}">
              <img src="components/${file}" alt="${file}" onclick="openModal('components/${file}')">
              <div class="screenshot-info">
                <div class="screenshot-name">${parts[0] || file}</div>
                <div class="screenshot-meta">Theme: ${parts[1] || 'N/A'} | State: ${parts[2] || 'N/A'}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
    ` : ''}
    
    ${storybookFiles.length > 0 ? `
    <section class="section">
      <h2>Storybook Documentation (${storybookFiles.length})</h2>
      <div class="grid">
        ${storybookFiles.map(file => {
          const parts = file.replace('.png', '').split('__');
          return `
            <div class="screenshot-card" data-theme="${parts[2] || 'unknown'}">
              <img src="storybook/${file}" alt="${file}" onclick="openModal('storybook/${file}')">
              <div class="screenshot-info">
                <div class="screenshot-name">${parts[0]}: ${parts[1] || ''}</div>
                <div class="screenshot-meta">Theme: ${parts[2] || 'N/A'}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
    ` : ''}
  </div>
  
  <div id="modal" class="modal" onclick="closeModal()">
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <img id="modal-image" src="" alt="Full size screenshot">
  </div>
  
  <script>
    function openModal(src) {
      const modal = document.getElementById('modal');
      const modalImg = document.getElementById('modal-image');
      modal.classList.add('active');
      modalImg.src = src;
      event.stopPropagation();
    }
    
    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }
    
    // Filter functionality
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const filter = btn.dataset.filter;
        const cards = document.querySelectorAll('.screenshot-card');
        
        cards.forEach(card => {
          if (filter === 'all') {
            card.style.display = 'block';
          } else {
            const theme = card.dataset.theme;
            const viewport = card.dataset.viewport;
            
            if (theme === filter || viewport === filter) {
              card.style.display = 'block';
            } else {
              card.style.display = 'none';
            }
          }
        });
      });
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  </script>
</body>
</html>
  `;

  const reportPath = path.join(config.outputDir, 'index.html');
  fs.writeFileSync(reportPath, html);
  console.log(`\n📄 HTML report generated: ${reportPath}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🎬 Cortex IDE Screenshot Capture');
  console.log('================================\n');

  const config = DEFAULT_CONFIG;
  
  // Setup
  console.log('📁 Setting up directories...');
  setupDirectories(config);

  // Run tests
  try {
    console.log('\n🧪 Running visual regression tests...');
    await runPlaywrightTests('tests/visual/visual-regression.spec.ts');
    
    console.log('\n🧪 Running component isolation tests...');
    await runPlaywrightTests('tests/visual/component-isolation.spec.ts');
    
    console.log('\n🧪 Running storybook tests...');
    await runPlaywrightTests('tests/visual/storybook-screenshots.spec.ts');
    
  } catch (error) {
    console.error('\n❌ Some tests failed, but continuing with report generation...');
  }

  // Generate report
  console.log('\n📊 Generating HTML report...');
  generateHtmlReport(config);

  console.log('\n✨ Screenshot capture completed!');
  console.log(`\n📸 Screenshots saved to: ${config.outputDir}`);
  console.log(`📄 View report: file://${path.join(config.outputDir, 'index.html')}`);
}

main().catch(console.error);
