const fs = require('fs');
const path = require('path');

function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.filter(l => l.trim().length > 0).length;
    
    // Count functions
    const functionMatches = content.match(/(?:function|=>|async\s+function|\basync\s+\()/g) || [];
    const functionCount = functionMatches.length;
    
    // Estimate complexity by counting decision points
    const complexityPoints = (content.match(/if|else|for|while|case|catch|\?\?|\|\||&&/g) || []).length;
    
    // Count comments
    const commentLines = (content.match(/\/\/|\/\*|\*\//g) || []).length;
    
    return {
      path: filePath.replace(/^.*\/packages\//, 'packages/'),
      lines: totalLines,
      functions: functionCount,
      complexity: complexityPoints,
      comments: commentLines
    };
  } catch (e) {
    return null;
  }
}

function walkDir(directory, results = []) {
  if (!fs.existsSync(directory)) return results;
  
  const files = fs.readdirSync(directory);
  files.forEach(file => {
    const fullPath = path.join(directory, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('dist') && !file.includes('test')) {
        walkDir(fullPath, results);
      } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('.test.') && !file.includes('.spec.')) {
        const metrics = analyzeFile(fullPath);
        if (metrics) results.push(metrics);
      }
    } catch (e) {
      // Skip files we can't access
    }
  });
  
  return results;
}

const metricsDir = 'quality-reports';
if (!fs.existsSync(metricsDir)) {
  fs.mkdirSync(metricsDir, { recursive: true });
}

const results = [];
const targetDirs = ['packages/main/src', 'packages/renderer/src', 'packages/ai-engine/src', 'packages/shared/src'];

targetDirs.forEach(dir => {
  walkDir(dir, results);
});

fs.writeFileSync(path.join(metricsDir, 'file-metrics.json'), JSON.stringify(results, null, 2));
console.log(`Analyzed ${results.length} files`);

// Calculate aggregate stats
const totalLines = results.reduce((sum, f) => sum + f.lines, 0);
const totalComplexity = results.reduce((sum, f) => sum + f.complexity, 0);
const totalComments = results.reduce((sum, f) => sum + f.comments, 0);
const filesOver300Lines = results.filter(f => f.lines > 300).length;
const highComplexityFiles = results.filter(f => f.complexity > 50).length;

console.log(`\nAggregate Metrics:`);
console.log(`- Total files: ${results.length}`);
console.log(`- Total lines: ${totalLines}`);
console.log(`- Avg lines per file: ${Math.round(totalLines / results.length)}`);
console.log(`- Files over 300 lines: ${filesOver300Lines}`);
console.log(`- High complexity files (>50): ${highComplexityFiles}`);
console.log(`- Comment density: ${((totalComments / totalLines) * 100).toFixed(2)}%`);

const summary = {
  totalFiles: results.length,
  totalLines,
  avgLinesPerFile: Math.round(totalLines / results.length),
  filesOver300Lines,
  highComplexityFiles,
  commentDensity: parseFloat(((totalComments / totalLines) * 100).toFixed(2)),
  topComplexFiles: results.sort((a, b) => b.complexity - a.complexity).slice(0, 10),
  topLargeFiles: results.sort((a, b) => b.lines - a.lines).slice(0, 10)
};

fs.writeFileSync(path.join(metricsDir, 'summary.json'), JSON.stringify(summary, null, 2));
