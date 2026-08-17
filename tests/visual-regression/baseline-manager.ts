/**
 * Visual regression baseline management
 */

import { copyFile, readdir, mkdir, unlink } from 'fs/promises';
import { join } from 'path';

const BASELINE_DIR = join(process.cwd(), 'tests/visual-regression/baseline');
const CURRENT_DIR = join(process.cwd(), 'tests/visual-regression/current');

/**
 * Update baseline with current screenshots
 */
export async function updateBaselines(): Promise<void> {
  await mkdir(BASELINE_DIR, { recursive: true });
  
  const currentFiles = await readdir(CURRENT_DIR);
  
  for (const file of currentFiles) {
    if (file.endsWith('.png')) {
      const currentPath = join(CURRENT_DIR, file);
      const baselinePath = join(BASELINE_DIR, file);
      
      await copyFile(currentPath, baselinePath);
      console.log(`Updated baseline: ${file}`);
    }
  }
}

/**
 * Clear baseline screenshots
 */
export async function clearBaselines(): Promise<void> {
  const files = await readdir(BASELINE_DIR);
  
  for (const file of files) {
    if (file.endsWith('.png')) {
      await unlink(join(BASELINE_DIR, file));
    }
  }
  
  console.log('Cleared all baselines');
}

/**
 * List all baseline screenshots
 */
export async function listBaselines(): Promise<string[]> {
  await mkdir(BASELINE_DIR, { recursive: true });
  const files = await readdir(BASELINE_DIR);
  return files.filter(f => f.endsWith('.png'));
}

// CLI commands
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'update':
      await updateBaselines();
      break;
    case 'clear':
      await clearBaselines();
      break;
    case 'list':
      const baselines = await listBaselines();
      console.log('Baselines:', baselines);
      break;
    default:
      console.log('Usage: bun baseline.ts <update|clear|list>');
  }
}
