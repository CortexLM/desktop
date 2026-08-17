/**
 * Storybook-Style Component Documentation Screenshots
 * Generates a visual component library documentation
 */

import { test, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots', 'storybook');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

interface ComponentStory {
  name: string;
  category: string;
  html: string;
  variants?: Array<{ name: string; modifier: string }>;
}

const COMPONENT_STORIES: ComponentStory[] = [
  {
    name: 'Button',
    category: 'UI Components',
    html: `
      <div class="component-showcase">
        <h2 class="text-xl font-semibold mb-4">Button Component</h2>
        <div class="grid grid-cols-3 gap-4">
          <div class="showcase-item">
            <label class="text-xs text-text-secondary mb-2 block">Primary</label>
            <button class="btn-primary">Primary Button</button>
          </div>
          <div class="showcase-item">
            <label class="text-xs text-text-secondary mb-2 block">Secondary</label>
            <button class="btn-secondary">Secondary Button</button>
          </div>
          <div class="showcase-item">
            <label class="text-xs text-text-secondary mb-2 block">Ghost</label>
            <button class="btn-ghost">Ghost Button</button>
          </div>
          <div class="showcase-item">
            <label class="text-xs text-text-secondary mb-2 block">Danger</label>
            <button class="btn-danger">Danger Button</button>
          </div>
          <div class="showcase-item">
            <label class="text-xs text-text-secondary mb-2 block">Disabled</label>
            <button class="btn-primary" disabled>Disabled</button>
          </div>
          <div class="showcase-item">
            <label class="text-xs text-text-secondary mb-2 block">Loading</label>
            <button class="btn-primary">
              <svg class="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Loading...
            </button>
          </div>
        </div>
      </div>
    `
  },
  {
    name: 'Input',
    category: 'UI Components',
    html: `
      <div class="component-showcase">
        <h2 class="text-xl font-semibold mb-4">Input Component</h2>
        <div class="space-y-4 max-w-md">
          <div>
            <label class="text-xs text-text-secondary mb-1 block">Default Input</label>
            <input type="text" placeholder="Enter text..." class="input w-full" />
          </div>
          <div>
            <label class="text-xs text-text-secondary mb-1 block">With Value</label>
            <input type="text" value="Some value" class="input w-full" />
          </div>
          <div>
            <label class="text-xs text-text-secondary mb-1 block">Error State</label>
            <input type="text" placeholder="Error..." class="input w-full border-error" />
            <span class="text-xs text-error mt-1">This field is required</span>
          </div>
          <div>
            <label class="text-xs text-text-secondary mb-1 block">Disabled</label>
            <input type="text" placeholder="Disabled..." class="input w-full" disabled />
          </div>
        </div>
      </div>
    `
  },
  {
    name: 'Card',
    category: 'UI Components',
    html: `
      <div class="component-showcase">
        <h2 class="text-xl font-semibold mb-4">Card Component</h2>
        <div class="grid grid-cols-2 gap-4 max-w-2xl">
          <div class="card">
            <div class="card-header">
              <h3 class="font-semibold">Simple Card</h3>
            </div>
            <div class="card-content">
              <p class="text-sm text-text-secondary">Card content goes here</p>
            </div>
          </div>
          <div class="card hover:shadow-lg transition-shadow cursor-pointer">
            <div class="card-header">
              <h3 class="font-semibold">Hoverable Card</h3>
            </div>
            <div class="card-content">
              <p class="text-sm text-text-secondary">Hover over me</p>
            </div>
            <div class="card-footer">
              <button class="btn-primary btn-sm">Action</button>
            </div>
          </div>
        </div>
      </div>
    `
  },
  {
    name: 'Typography',
    category: 'Foundation',
    html: `
      <div class="component-showcase">
        <h2 class="text-xl font-semibold mb-4">Typography</h2>
        <div class="space-y-4">
          <div>
            <span class="text-xs text-text-secondary">Heading 1</span>
            <h1 class="text-4xl font-bold">The quick brown fox</h1>
          </div>
          <div>
            <span class="text-xs text-text-secondary">Heading 2</span>
            <h2 class="text-3xl font-semibold">The quick brown fox</h2>
          </div>
          <div>
            <span class="text-xs text-text-secondary">Heading 3</span>
            <h3 class="text-2xl font-semibold">The quick brown fox</h3>
          </div>
          <div>
            <span class="text-xs text-text-secondary">Body Large</span>
            <p class="text-lg">The quick brown fox jumps over the lazy dog</p>
          </div>
          <div>
            <span class="text-xs text-text-secondary">Body</span>
            <p class="text-base">The quick brown fox jumps over the lazy dog</p>
          </div>
          <div>
            <span class="text-xs text-text-secondary">Body Small</span>
            <p class="text-sm">The quick brown fox jumps over the lazy dog</p>
          </div>
          <div>
            <span class="text-xs text-text-secondary">Caption</span>
            <p class="text-xs text-text-secondary">The quick brown fox jumps over the lazy dog</p>
          </div>
        </div>
      </div>
    `
  },
  {
    name: 'Colors',
    category: 'Foundation',
    html: `
      <div class="component-showcase">
        <h2 class="text-xl font-semibold mb-4">Color Palette</h2>
        <div class="space-y-6">
          <div>
            <h3 class="text-sm font-semibold mb-2">Semantic Colors</h3>
            <div class="grid grid-cols-4 gap-4">
              <div>
                <div class="h-16 bg-accent rounded mb-1"></div>
                <span class="text-xs">Accent</span>
              </div>
              <div>
                <div class="h-16 bg-success rounded mb-1"></div>
                <span class="text-xs">Success</span>
              </div>
              <div>
                <div class="h-16 bg-warning rounded mb-1"></div>
                <span class="text-xs">Warning</span>
              </div>
              <div>
                <div class="h-16 bg-error rounded mb-1"></div>
                <span class="text-xs">Error</span>
              </div>
            </div>
          </div>
          <div>
            <h3 class="text-sm font-semibold mb-2">Neutral Colors</h3>
            <div class="grid grid-cols-4 gap-4">
              <div>
                <div class="h-16 bg-background rounded border border-border mb-1"></div>
                <span class="text-xs">Background</span>
              </div>
              <div>
                <div class="h-16 bg-surface rounded border border-border mb-1"></div>
                <span class="text-xs">Surface</span>
              </div>
              <div>
                <div class="h-16 bg-border rounded mb-1"></div>
                <span class="text-xs">Border</span>
              </div>
              <div>
                <div class="h-16 bg-text rounded mb-1"></div>
                <span class="text-xs">Text</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  },
  {
    name: 'Git Status Badge',
    category: 'Git Components',
    html: `
      <div class="component-showcase">
        <h2 class="text-xl font-semibold mb-4">Git Status Badges</h2>
        <div class="flex flex-wrap gap-2">
          <span class="px-2 py-1 text-xs rounded bg-success/20 text-success">Added</span>
          <span class="px-2 py-1 text-xs rounded bg-warning/20 text-warning">Modified</span>
          <span class="px-2 py-1 text-xs rounded bg-error/20 text-error">Deleted</span>
          <span class="px-2 py-1 text-xs rounded bg-accent/20 text-accent">Renamed</span>
          <span class="px-2 py-1 text-xs rounded bg-surface border border-border">Untracked</span>
        </div>
      </div>
    `
  },
  {
    name: 'File Tree',
    category: 'Editor Components',
    html: `
      <div class="component-showcase">
        <h2 class="text-xl font-semibold mb-4">File Tree</h2>
        <div class="w-64 bg-surface border border-border rounded p-2">
          <div class="file-tree">
            <div class="flex items-center gap-1 px-2 py-1 hover:bg-accent/10 rounded cursor-pointer">
              <span class="text-xs">▼</span>
              <span class="text-sm">src/</span>
            </div>
            <div class="ml-4">
              <div class="flex items-center gap-1 px-2 py-1 hover:bg-accent/10 rounded cursor-pointer">
                <span class="text-xs">▼</span>
                <span class="text-sm">components/</span>
              </div>
              <div class="ml-4">
                <div class="flex items-center gap-1 px-2 py-1 hover:bg-accent/10 rounded cursor-pointer">
                  <span class="text-xs">📄</span>
                  <span class="text-sm">Button.tsx</span>
                </div>
                <div class="flex items-center gap-1 px-2 py-1 hover:bg-accent/10 rounded cursor-pointer">
                  <span class="text-xs">📄</span>
                  <span class="text-sm">Input.tsx</span>
                </div>
              </div>
              <div class="flex items-center gap-1 px-2 py-1 hover:bg-accent/10 rounded cursor-pointer">
                <span class="text-xs">▶</span>
                <span class="text-sm">utils/</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  },
  {
    name: 'Terminal Output',
    category: 'Terminal Components',
    html: `
      <div class="component-showcase">
        <h2 class="text-xl font-semibold mb-4">Terminal Output</h2>
        <div class="w-full max-w-2xl bg-[#1e1e1e] rounded border border-border p-4 font-mono text-sm">
          <div class="text-green-400">$ npm run dev</div>
          <div class="text-gray-400 mt-2">&gt; cortex-ide@0.1.0 dev</div>
          <div class="text-gray-400">&gt; bun run --filter main dev</div>
          <div class="mt-2">
            <span class="text-cyan-400">info</span> <span class="text-gray-300">Starting Electron app...</span>
          </div>
          <div>
            <span class="text-green-400">success</span> <span class="text-gray-300">App ready on http://localhost:5173</span>
          </div>
          <div>
            <span class="text-yellow-400">warn</span> <span class="text-gray-300">Using development mode</span>
          </div>
          <div>
            <span class="text-red-400">error</span> <span class="text-gray-300">Failed to load module</span>
          </div>
          <div class="mt-2 text-green-400">$ <span class="animate-pulse">_</span></div>
        </div>
      </div>
    `
  },
  {
    name: 'Code Block',
    category: 'Editor Components',
    html: `
      <div class="component-showcase">
        <h2 class="text-xl font-semibold mb-4">Code Block</h2>
        <div class="w-full max-w-2xl bg-surface border border-border rounded overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2 bg-background border-b border-border">
            <span class="text-xs text-text-secondary">example.ts</span>
            <button class="text-xs text-accent hover:text-accent/80">Copy</button>
          </div>
          <pre class="p-4 font-mono text-sm overflow-x-auto"><code><span class="text-purple-400">import</span> <span class="text-yellow-300">React</span> <span class="text-purple-400">from</span> <span class="text-green-300">'react'</span>;

<span class="text-purple-400">export</span> <span class="text-purple-400">function</span> <span class="text-blue-300">Button</span>({ <span class="text-orange-300">children</span> }: <span class="text-cyan-300">Props</span>) {
  <span class="text-purple-400">return</span> (
    <span class="text-gray-400">&lt;</span><span class="text-green-300">button</span> <span class="text-cyan-300">className</span>=<span class="text-green-300">"btn-primary"</span><span class="text-gray-400">&gt;</span>
      {<span class="text-orange-300">children</span>}
    <span class="text-gray-400">&lt;/</span><span class="text-green-300">button</span><span class="text-gray-400">&gt;</span>
  );
}</code></pre>
        </div>
      </div>
    `
  },
  {
    name: 'Agent Message Bubble',
    category: 'AI Components',
    html: `
      <div class="component-showcase">
        <h2 class="text-xl font-semibold mb-4">Agent Message Bubble</h2>
        <div class="space-y-4 max-w-2xl">
          <div class="flex gap-3">
            <div class="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold">
              AI
            </div>
            <div class="flex-1 bg-surface border border-border rounded-lg p-3">
              <div class="text-sm">
                I'll help you implement that feature. Here's what I suggest:
              </div>
              <div class="mt-2 text-xs text-text-secondary">
                Just now
              </div>
            </div>
          </div>
          <div class="flex gap-3 flex-row-reverse">
            <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-semibold text-white">
              U
            </div>
            <div class="flex-1 bg-accent/10 border border-accent/20 rounded-lg p-3">
              <div class="text-sm">
                Can you help me with this code?
              </div>
              <div class="mt-2 text-xs text-text-secondary text-right">
                2 minutes ago
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }
];

async function captureStory(page: Page, story: ComponentStory, theme: 'light' | 'dark') {
  const html = `
    <!DOCTYPE html>
    <html data-theme="${theme}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        
        [data-theme="dark"] {
          --background: #0a0a0a;
          --surface: #1a1a1a;
          --border: #2a2a2a;
          --text: #ffffff;
          --text-secondary: #888888;
          --accent: #3b82f6;
          --success: #10b981;
          --warning: #f59e0b;
          --error: #ef4444;
        }
        
        [data-theme="light"] {
          --background: #ffffff;
          --surface: #f9fafb;
          --border: #e5e7eb;
          --text: #000000;
          --text-secondary: #6b7280;
          --accent: #2563eb;
          --success: #059669;
          --warning: #d97706;
          --error: #dc2626;
        }
        
        body {
          background-color: var(--background);
          color: var(--text);
        }
        
        .component-showcase {
          padding: 2rem;
          min-height: 100vh;
        }
        
        /* Component styles */
        .btn-primary, .btn-secondary, .btn-ghost, .btn-danger {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }
        
        .btn-primary {
          background-color: var(--accent);
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }
        
        .btn-secondary {
          background-color: var(--surface);
          color: var(--text);
          border: 1px solid var(--border);
        }
        
        .btn-ghost {
          background-color: transparent;
          color: var(--text-secondary);
        }
        
        .btn-ghost:hover:not(:disabled) {
          background-color: var(--surface);
        }
        
        .btn-danger {
          background-color: var(--error);
          color: white;
        }
        
        .btn-primary:disabled, .btn-secondary:disabled, .btn-ghost:disabled, .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .input {
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.375rem;
          background-color: var(--surface);
          color: var(--text);
          font-size: 0.875rem;
        }
        
        .input:focus {
          outline: none;
          border-color: var(--accent);
        }
        
        .input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .card {
          background-color: var(--surface);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          overflow: hidden;
        }
        
        .card-header, .card-content, .card-footer {
          padding: 1rem;
        }
        
        .card-header {
          border-bottom: 1px solid var(--border);
        }
        
        .card-footer {
          border-top: 1px solid var(--border);
        }
      </style>
    </head>
    <body>
      ${story.html}
    </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForTimeout(500);

  const filename = `${story.category.replace(/\s+/g, '-').toLowerCase()}__${story.name.replace(/\s+/g, '-').toLowerCase()}__${theme}.png`;
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, filename),
    fullPage: true
  });

  console.log(`📸 Storybook: ${filename}`);
}

test.describe('Storybook Component Documentation', () => {
  for (const story of COMPONENT_STORIES) {
    test(`${story.category} - ${story.name}`, async ({ page }) => {
      await captureStory(page, story, 'dark');
      await captureStory(page, story, 'light');
    });
  }
});
