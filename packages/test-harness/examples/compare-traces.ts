import { TraceStorage } from '../src/index.js';

/**
 * Example: Compare two trace files
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: bun examples/compare-traces.ts <trace-id-1> <trace-id-2>');
    process.exit(1);
  }
  
  const [traceId1, traceId2] = args;
  const storage = new TraceStorage('./traces');
  
  console.log(`🔍 Comparing traces:\n   ${traceId1}\n   ${traceId2}\n`);
  
  try {
    const diff = await storage.compareTraces(traceId1, traceId2);
    const report = storage.generateDiffReport(diff);
    
    console.log(report);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
