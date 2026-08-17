/**
 * Context compression utilities for managing large codebases
 * Intelligent summarization and key information extraction
 */

export interface CompressionConfig {
  targetTokens: number;
  preserveStructure?: boolean;
  keepComments?: boolean;
  keepTypes?: boolean;
  summarizationLevel?: 'light' | 'medium' | 'aggressive';
}

export interface CompressionResult {
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract function/class signatures without implementation
 */
export function extractSignatures(code: string): string {
  const lines = code.split('\n');
  const signatures: string[] = [];
  let inBlockComment = false;
  let braceDepth = 0;
  let currentSignature = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track block comments
    if (trimmed.includes('/*')) inBlockComment = true;
    if (trimmed.includes('*/')) {
      inBlockComment = false;
      continue;
    }
    if (inBlockComment) continue;

    // Skip single-line comments
    if (trimmed.startsWith('//')) continue;
    if (trimmed === '') continue;

    // Track brace depth
    braceDepth += (line.match(/{/g) || []).length;
    braceDepth -= (line.match(/}/g) || []).length;

    // Capture signatures (function/class/interface/type declarations)
    if (braceDepth === 0 || braceDepth === 1) {
      if (
        // Imports name the file's dependencies, which is exactly the context a
        // signature summary is for. Dropping them made `medium` compression
        // lose information that `aggressive` keeps.
        trimmed.startsWith('import') ||
        trimmed.startsWith('export') ||
        trimmed.startsWith('function') ||
        trimmed.startsWith('class') ||
        trimmed.startsWith('interface') ||
        trimmed.startsWith('type') ||
        trimmed.startsWith('const') ||
        trimmed.startsWith('let') ||
        trimmed.startsWith('async')
      ) {
        currentSignature = line;
        
        // If line ends with {, it's a complete signature
        if (line.includes('{') || line.includes(';')) {
          signatures.push(currentSignature.replace(/\{[\s\S]*$/, '{ /* ... */ }'));
          currentSignature = '';
        }
      } else if (currentSignature) {
        currentSignature += '\n' + line;
        if (line.includes('{') || line.includes(';')) {
          signatures.push(currentSignature.replace(/\{[\s\S]*$/, '{ /* ... */ }'));
          currentSignature = '';
        }
      }
    }
  }

  return signatures.join('\n\n');
}

/**
 * Summarize code file while preserving key information
 */
export function summarizeCode(code: string, config: CompressionConfig): CompressionResult {
  const originalTokens = estimateTokens(code);
  let compressed = code;

  switch (config.summarizationLevel) {
    case 'light':
      // Remove only obvious noise: empty lines, excessive whitespace
      compressed = code
        .split('\n')
        .filter(line => line.trim().length > 0)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
      break;

    case 'medium':
      // Keep signatures and type definitions, remove implementations
      if (config.keepTypes && config.preserveStructure) {
        compressed = extractSignatures(code);
      } else {
        compressed = code
          .split('\n')
          .filter(line => {
            const trimmed = line.trim();
            // Keep imports, exports, type definitions, function signatures
            return (
              trimmed.startsWith('import') ||
              trimmed.startsWith('export') ||
              trimmed.startsWith('interface') ||
              trimmed.startsWith('type') ||
              trimmed.includes('function') ||
              trimmed.includes('class') ||
              trimmed.includes('const') ||
              trimmed.includes('let')
            );
          })
          .join('\n');
      }
      break;

    case 'aggressive':
      // Extract only essential structure: exports and types
      const imports = code.match(/^import .+$/gm) || [];
      const exports = code.match(/^export .+$/gm) || [];
      const types = code.match(/^(interface|type) .+$/gm) || [];
      
      compressed = [
        ...imports.slice(0, 3), // First 3 imports
        imports.length > 3 ? `// ... ${imports.length - 3} more imports` : '',
        '',
        ...types,
        '',
        ...exports.map(exp => {
          // Simplify export statements
          if (exp.includes('{')) {
            return exp.split('{')[0] + '{ /* ... */ }';
          }
          return exp.split('=')[0] + '= /* ... */;';
        }),
      ].filter(Boolean).join('\n');
      break;
  }

  const compressedTokens = estimateTokens(compressed);

  return {
    compressed,
    originalTokens,
    compressedTokens,
    compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
  };
}

/**
 * Extract key information from code (imports, exports, types)
 */
export function extractKeyInfo(code: string): {
  imports: string[];
  exports: string[];
  types: string[];
  functions: string[];
  classes: string[];
} {
  const lines = code.split('\n');

  return {
    imports: lines.filter(l => l.trim().startsWith('import')),
    exports: lines.filter(l => l.trim().startsWith('export')),
    types: lines.filter(l => {
      const trimmed = l.trim();
      return trimmed.startsWith('interface') || trimmed.startsWith('type ');
    }),
    functions: lines.filter(l => {
      const trimmed = l.trim();
      return (
        trimmed.includes('function') ||
        (trimmed.includes('=>') && (trimmed.startsWith('const') || trimmed.startsWith('export const')))
      );
    }),
    // `export`/`default`/`abstract` may precede `class`, and exported classes
    // are the ones most worth reporting, so anchoring on `class` alone missed
    // the common case.
    classes: lines.filter(l => /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s/.test(l)),
  };
}

/**
 * Create hierarchical summary of codebase
 */
export interface FileNode {
  path: string;
  summary: string;
  tokens: number;
  keyExports?: string[];
}

export function summarizeFileTree(files: Map<string, string>, config: CompressionConfig): FileNode[] {
  const summaries: FileNode[] = [];

  for (const [path, content] of files) {
    const keyInfo = extractKeyInfo(content);
    const compressed = summarizeCode(content, config);

    summaries.push({
      path,
      summary: compressed.compressed,
      tokens: compressed.compressedTokens,
      keyExports: keyInfo.exports.map(exp => {
        // Extract export names
        const match = exp.match(/export\s+(const|function|class|interface|type)\s+(\w+)/);
        return match ? match[2] : '';
      }).filter(Boolean),
    });
  }

  // Sort by importance (more exports = more important)
  return summaries.sort((a, b) => {
    const aExports = a.keyExports?.length || 0;
    const bExports = b.keyExports?.length || 0;
    return bExports - aExports;
  });
}

/**
 * Intelligent context selection for large codebases
 */
export interface ContextWindow {
  essential: string[]; // Must-include context
  relevant: string[];  // Nice-to-have context
  background: string[]; // Optional context
}

export function selectContext(
  allFiles: Map<string, string>,
  focusFiles: string[],
  tokenBudget: number,
  config: CompressionConfig
): ContextWindow {
  const essential: string[] = [];
  const relevant: string[] = [];
  const background: string[] = [];

  let usedTokens = 0;

  // 1. Essential: Focus files (full content or medium compression)
  for (const path of focusFiles) {
    const content = allFiles.get(path);
    if (!content) continue;

    const compressed = summarizeCode(content, {
      ...config,
      summarizationLevel: 'medium',
    });

    if (usedTokens + compressed.compressedTokens <= tokenBudget * 0.5) {
      essential.push(`// File: ${path}\n${compressed.compressed}`);
      usedTokens += compressed.compressedTokens;
    }
  }

  // 2. Relevant: Dependencies of focus files (aggressive compression)
  const dependencies = extractDependencies(allFiles, focusFiles);
  for (const path of dependencies) {
    const content = allFiles.get(path);
    if (!content) continue;

    const compressed = summarizeCode(content, {
      ...config,
      summarizationLevel: 'aggressive',
    });

    if (usedTokens + compressed.compressedTokens <= tokenBudget * 0.8) {
      relevant.push(`// File: ${path}\n${compressed.compressed}`);
      usedTokens += compressed.compressedTokens;
    }
  }

  // 3. Background: Remaining files (signatures only)
  for (const [path, content] of allFiles) {
    if (focusFiles.includes(path) || dependencies.includes(path)) continue;

    const keyInfo = extractKeyInfo(content);
    if (keyInfo.exports.length === 0) continue; // Skip files without exports

    const summary = `// ${path}: ${keyInfo.exports.length} exports`;
    const tokens = estimateTokens(summary);

    if (usedTokens + tokens <= tokenBudget) {
      background.push(summary);
      usedTokens += tokens;
    }
  }

  return { essential, relevant, background };
}

/**
 * Extract file dependencies from imports
 */
function extractDependencies(allFiles: Map<string, string>, focusFiles: string[]): string[] {
  const deps = new Set<string>();

  for (const focusFile of focusFiles) {
    const content = allFiles.get(focusFile);
    if (!content) continue;

    const imports = content.match(/from ['"](.+)['"]/g) || [];
    for (const imp of imports) {
      const match = imp.match(/from ['"](.+)['"]/);
      if (!match) continue;

      let importPath = match[1];
      
      // Resolve relative imports
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        // Simple resolution (would need proper path resolution in real implementation)
        importPath = importPath.replace(/^\.\.?\//, '');
        
        // Find matching file
        for (const [path] of allFiles) {
          if (path.includes(importPath)) {
            deps.add(path);
            break;
          }
        }
      }
    }
  }

  return Array.from(deps);
}

/**
 * Progressive compression: compress until target token count is reached
 */
export function compressToTarget(
  content: string,
  targetTokens: number,
  config: Omit<CompressionConfig, 'targetTokens'>
): CompressionResult {
  const levels: Array<'light' | 'medium' | 'aggressive'> = ['light', 'medium', 'aggressive'];

  for (const level of levels) {
    const result = summarizeCode(content, {
      ...config,
      targetTokens,
      summarizationLevel: level,
    });

    if (result.compressedTokens <= targetTokens) {
      return result;
    }
  }

  // If even aggressive compression isn't enough, truncate
  const aggressive = summarizeCode(content, {
    ...config,
    targetTokens,
    summarizationLevel: 'aggressive',
  });

  const truncated = aggressive.compressed.slice(0, targetTokens * 4); // ~4 chars per token
  return {
    compressed: truncated + '\n\n// ... (truncated)',
    originalTokens: estimateTokens(content),
    compressedTokens: targetTokens,
    compressionRatio: targetTokens / estimateTokens(content),
  };
}
