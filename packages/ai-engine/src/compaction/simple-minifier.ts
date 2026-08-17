/**
 * Simple, realistic code minifier.
 * No unrealistic compression ratios - just practical whitespace/comment removal.
 */

export interface MinificationResult {
  minified: string;
  originalSize: number;
  minifiedSize: number;
  ratio: number;
  bytesaved: number;
}

/**
 * Minify code by removing comments and excessive whitespace.
 * Maintains readability and semantic correctness.
 */
export function minifyCode(code: string, language: string): MinificationResult {
  const originalSize = code.length;
  let result = code;

  // Remove comments based on language
  result = removeComments(result, language);
  
  // Normalize whitespace
  result = normalizeWhitespace(result);
  
  const minifiedSize = result.length;
  const bytesaved = originalSize - minifiedSize;
  const ratio = originalSize / minifiedSize;

  return {
    minified: result,
    originalSize,
    minifiedSize,
    ratio,
    bytesaved,
  };
}

function removeComments(code: string, language: string): string {
  switch (language.toLowerCase()) {
    case 'typescript':
    case 'javascript':
    case 'rust':
    case 'c':
    case 'cpp':
    case 'java':
      return removeCStyleComments(code);
    case 'python':
      return removePythonComments(code);
    default:
      return code; // Unknown language, don't touch
  }
}

function removeCStyleComments(code: string): string {
  // Remove multi-line comments /* ... */
  code = code.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove single-line comments //
  code = code.replace(/\/\/.*$/gm, '');
  
  return code;
}

function removePythonComments(code: string): string {
  // Remove single-line comments #
  code = code.replace(/#.*$/gm, '');
  
  // Remove docstrings (triple quotes)
  code = code.replace(/"""[\s\S]*?"""/g, '');
  code = code.replace(/'''[\s\S]*?'''/g, '');
  
  return code;
}

function normalizeWhitespace(code: string): string {
  // Remove trailing whitespace
  code = code.replace(/[ \t]+$/gm, '');
  
  // Collapse multiple blank lines to max 2
  code = code.replace(/\n{3,}/g, '\n\n');
  
  // Remove leading/trailing whitespace
  code = code.trim();
  
  return code;
}
