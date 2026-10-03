import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(path.join(process.cwd(), "package.json"));
const { PNG } = require("pngjs"), pixelmatch = require("pixelmatch").default;
const out = path.dirname(fileURLToPath(import.meta.url)), root = "/tmp/opencode/live-recovery-final-compare";
const rows = JSON.parse(fs.readFileSync(path.join(root, "report.json")));
const historicalRoot = "/tmp/opencode/current-full-compare-6d96535";
const historical = JSON.parse(fs.readFileSync(path.join(historicalRoot, "report.json")));
const read = (root, file) => PNG.sync.read(fs.readFileSync(path.join(root, file)));
const region = [1110,510,2440,1490];
const crop = (png, [x0,y0,x1,y1]) => {
  const b = Buffer.alloc((x1-x0)*(y1-y0)*4);
  for(let y=y0;y<y1;y++) png.data.copy(b,(y-y0)*(x1-x0)*4,(y*png.width+x0)*4,(y*png.width+x1)*4);
  return b;
};
const exact = (a,b) => { let count=0; for(let i=0;i<a.length;i+=4) if(!a.subarray(i,i+4).equals(b.subarray(i,i+4))) count++; return count; };
const results = [];
for(const row of rows) {
  const app = read(root,row.files.app.file), previous = historical.find(x=>x.name===row.name), prior = read(historicalRoot,previous.files.app.file);
  const content = [754,260,2780,1560], aa = crop(app,content), pp = crop(prior,content);
  const result = { name:row.name, previousRoundedDiffPct:previous.diffPct??null,
    originalAppContentComparison:{rectangle:content,pixelmatchDifferentPixels:pixelmatch(aa,pp,null,content[2]-content[0],content[3]-content[1],{threshold:.15})} };
  if(row.files.design) {
    const design=read(root,row.files.design.file), n=pixelmatch(app.data,design.data,null,app.width,app.height,{threshold:.15}), raw=100*n/(app.width*app.height);
    assert.equal(+raw.toFixed(2),row.diffPct);
    Object.assign(result,{differentPixels:n,rawDiffPct:raw,roundedDiffPct:+raw.toFixed(2)});
    if(row.name.startsWith("work-task~done-")) {
      const a=crop(app,region),b=crop(design,region);
      result.unshiftedTranscriptRegion={rectangle:region,pixels:(region[2]-region[0])*(region[3]-region[1]),exactDifferentPixels:exact(a,b),pixelmatchDifferentPixels:pixelmatch(a,b,null,region[2]-region[0],region[3]-region[1],{threshold:.15})};
      assert.equal(result.unshiftedTranscriptRegion.exactDifferentPixels,0);
    }
  }
  results.push(result);
}
fs.writeFileSync(path.join(out,"pixel-verification.json"),JSON.stringify(results,null,2)+"\n");
console.log(JSON.stringify({recomputed:results.filter(x=>x.differentPixels!==undefined).length,max:results.filter(x=>x.differentPixels!==undefined).sort((a,b)=>b.differentPixels-a.differentPixels).slice(0,6),workDone:results.filter(x=>x.name.startsWith("work-task~done-"))},null,2));
