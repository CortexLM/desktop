/**
 * Language Detection - Maps file extensions to Monaco Editor language IDs
 */

export function detectLanguageFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, string> = {
    // JavaScript / TypeScript
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    
    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    
    // JSON / YAML / TOML
    'json': 'json',
    'jsonc': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    
    // Markdown
    'md': 'markdown',
    'mdx': 'markdown',
    
    // Python
    'py': 'python',
    'pyw': 'python',
    'pyi': 'python',
    
    // Go
    'go': 'go',
    
    // Rust
    'rs': 'rust',
    
    // C / C++
    'c': 'c',
    'h': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'hpp': 'cpp',
    'hxx': 'cpp',
    
    // C#
    'cs': 'csharp',
    
    // Java
    'java': 'java',
    
    // PHP
    'php': 'php',
    
    // Ruby
    'rb': 'ruby',
    
    // Shell
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    
    // SQL
    'sql': 'sql',
    
    // XML
    'xml': 'xml',
    'svg': 'xml',
    
    // Docker
    'dockerfile': 'dockerfile',
    
    // Other
    'txt': 'plaintext',
    'log': 'plaintext',
    'env': 'plaintext',
    'gitignore': 'plaintext',
  };
  
  // Special cases for files without extensions
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
  if (fileName === 'dockerfile') return 'dockerfile';
  if (fileName === 'makefile') return 'makefile';
  if (fileName.startsWith('.env')) return 'plaintext';
  if (fileName === '.gitignore') return 'plaintext';
  if (fileName === 'package.json') return 'json';
  if (fileName === 'tsconfig.json') return 'json';
  
  return languageMap[extension] || 'plaintext';
}

export function getLanguageIcon(language: string): string {
  const iconMap: Record<string, string> = {
    'javascript': '󰌞',
    'typescript': '󰛦',
    'python': '',
    'go': '󰟓',
    'rust': '',
    'c': '',
    'cpp': '',
    'csharp': '󰌛',
    'java': '',
    'php': '󰌟',
    'ruby': '',
    'html': '',
    'css': '',
    'json': '',
    'yaml': '',
    'markdown': '',
    'sql': '',
    'shell': '',
    'xml': '󰗀',
    'dockerfile': '󰡨',
  };
  
  return iconMap[language] || '󰈔';
}
