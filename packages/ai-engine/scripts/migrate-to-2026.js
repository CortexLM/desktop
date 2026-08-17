#!/usr/bin/env node

/**
 * Migration script for AI Engine 2.0 (2026 models)
 * 
 * Usage:
 *   node scripts/migrate-to-2026.js [--dry-run] [--interactive]
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const OLD_TO_NEW_MODELS = {
  // OpenAI
  'gpt-4': 'gpt-4.5-turbo',
  'gpt-4o': 'gpt-4.5-turbo',
  'gpt-4-turbo': 'gpt-4.5-turbo',
  
  // Anthropic
  'claude-3-5-sonnet-20241022': 'claude-opus-4.8',
  'claude-3-5-sonnet': 'claude-opus-4.8',
  'claude-3-opus': 'claude-opus-4.8',
  
  // OpenRouter
  'anthropic/claude-3.5-sonnet': 'anthropic/claude-opus-4.8-fast',
  'anthropic/claude-3-opus': 'anthropic/claude-opus-4.8-fast',
  'openai/gpt-4': 'openai/gpt-4.5-turbo',
  'openai/gpt-4o': 'openai/gpt-4.5-turbo',
};

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isInteractive = args.includes('--interactive');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function confirm(message) {
  const answer = await question(`${message} (y/N): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

function findFiles(dir, pattern, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules and hidden directories
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    
    if (entry.isDirectory()) {
      findFiles(fullPath, pattern, files);
    } else if (pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const changes = [];
  
  for (const [oldModel, newModel] of Object.entries(OLD_TO_NEW_MODELS)) {
    // Check for string literals
    const regex = new RegExp(`['"\`]${oldModel.replace(/\//g, '\\/')}['"\`]`, 'g');
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      changes.push({
        file: filePath,
        line,
        oldModel,
        newModel,
        context: getLineContext(content, match.index),
      });
    }
  }
  
  return changes;
}

function getLineContext(content, index) {
  const lines = content.substring(0, index).split('\n');
  const lineNumber = lines.length;
  const allLines = content.split('\n');
  
  const start = Math.max(0, lineNumber - 2);
  const end = Math.min(allLines.length, lineNumber + 1);
  
  return allLines.slice(start, end).join('\n');
}

function applyChanges(filePath, changes) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Group changes by file
  const fileChanges = changes.filter(c => c.file === filePath);
  
  // Apply replacements (in reverse order to preserve indices)
  fileChanges.reverse().forEach(change => {
    const regex = new RegExp(`(['"\`])${change.oldModel.replace(/\//g, '\\/')}\\1`, 'g');
    content = content.replace(regex, `$1${change.newModel}$1`);
  });
  
  fs.writeFileSync(filePath, content, 'utf-8');
}

function analyzeEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const changes = [];
  
  const envVars = {
    'OPENAI_DEFAULT_MODEL': ['gpt-4o', 'gpt-4.5-turbo'],
    'ANTHROPIC_DEFAULT_MODEL': ['claude-3-5-sonnet-20241022', 'claude-opus-4.8'],
    'OPENROUTER_DEFAULT_MODEL': ['anthropic/claude-3.5-sonnet', 'anthropic/claude-opus-4.8-fast'],
  };
  
  for (const [varName, [oldValue, newValue]] of Object.entries(envVars)) {
    const regex = new RegExp(`^${varName}=.*${oldValue}`, 'm');
    if (regex.test(content)) {
      changes.push({
        file: filePath,
        varName,
        oldValue,
        newValue,
      });
    }
  }
  
  return changes;
}

function applyEnvChanges(filePath, changes) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  changes.forEach(change => {
    const regex = new RegExp(`(${change.varName}=.*)${change.oldValue}`, 'g');
    content = content.replace(regex, `$1${change.newValue}`);
  });
  
  fs.writeFileSync(filePath, content, 'utf-8');
}

async function main() {
  console.log('🔄 AI Engine 2.0 Migration Tool\n');
  console.log('Searching for files with old model references...\n');
  
  const cwd = process.cwd();
  
  // Find TypeScript/JavaScript files
  const codeFiles = findFiles(cwd, /\.(ts|tsx|js|jsx)$/);
  console.log(`Found ${codeFiles.length} code files\n`);
  
  // Analyze all files
  const allChanges = [];
  for (const file of codeFiles) {
    const changes = analyzeFile(file);
    allChanges.push(...changes);
  }
  
  // Analyze .env files
  const envFiles = ['.env', '.env.local', '.env.development', '.env.production']
    .map(name => path.join(cwd, name));
  
  const envChanges = [];
  for (const envFile of envFiles) {
    const changes = analyzeEnvFile(envFile);
    envChanges.push(...changes);
  }
  
  // Report findings
  console.log(`📊 Analysis Results:\n`);
  console.log(`   Code changes: ${allChanges.length}`);
  console.log(`   Env changes: ${envChanges.length}\n`);
  
  if (allChanges.length === 0 && envChanges.length === 0) {
    console.log('✅ No old model references found. You\'re already up to date!');
    rl.close();
    return;
  }
  
  // Display changes
  if (allChanges.length > 0) {
    console.log('📝 Code Changes:\n');
    
    const byFile = {};
    allChanges.forEach(change => {
      if (!byFile[change.file]) byFile[change.file] = [];
      byFile[change.file].push(change);
    });
    
    for (const [file, changes] of Object.entries(byFile)) {
      console.log(`   ${path.relative(cwd, file)}:`);
      changes.forEach(change => {
        console.log(`      Line ${change.line}: ${change.oldModel} → ${change.newModel}`);
      });
      console.log();
    }
  }
  
  if (envChanges.length > 0) {
    console.log('🔐 Environment Variable Changes:\n');
    envChanges.forEach(change => {
      console.log(`   ${path.relative(cwd, change.file)}:`);
      console.log(`      ${change.varName}: ${change.oldValue} → ${change.newValue}\n`);
    });
  }
  
  // Dry run or apply
  if (isDryRun) {
    console.log('🔍 Dry run mode - no changes applied');
    rl.close();
    return;
  }
  
  // Interactive confirmation
  if (isInteractive) {
    const shouldApply = await confirm('\nApply these changes?');
    if (!shouldApply) {
      console.log('❌ Migration cancelled');
      rl.close();
      return;
    }
  }
  
  // Apply changes
  console.log('\n🔧 Applying changes...\n');
  
  const changedFiles = new Set(allChanges.map(c => c.file));
  for (const file of changedFiles) {
    applyChanges(file, allChanges);
    console.log(`   ✓ Updated ${path.relative(cwd, file)}`);
  }
  
  for (const change of envChanges) {
    if (!changedFiles.has(change.file)) {
      applyEnvChanges(change.file, envChanges.filter(c => c.file === change.file));
      console.log(`   ✓ Updated ${path.relative(cwd, change.file)}`);
      changedFiles.add(change.file);
    }
  }
  
  console.log('\n✅ Migration completed successfully!\n');
  console.log('📚 Next steps:');
  console.log('   1. Review the changes');
  console.log('   2. Test your application');
  console.log('   3. Read AI_MODELS_2026.md for more info');
  console.log('   4. Consider using model presets (fastest, smartest, cheapest, reasoning)\n');
  
  rl.close();
}

main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
