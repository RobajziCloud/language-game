// Usage:
// 1) Save as scripts/gen-manifests.mjs
// 2) Run: node scripts/gen-manifests.mjs
//    (from project root)
// 3) It scans public/data for files like:
//    sentences-A2-1.json, sentences-A2-01.json, sentences-B1-12.json, ...
//    and writes index-A2.json, index-B1.json, index-B2.json with discovered IDs.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const LEVELS = ['A2','B1','B2'];

const RE = /^sentences-(A2|B1|B2)-(?:(\d{1,2}))\.json$/i;

async function ensureDir(dir){
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

async function listFilesRecursive(dir){
  const out=[];
  const stack=[dir];
  while(stack.length){
    const d = stack.pop();
    const entries = await fs.readdir(d, { withFileTypes:true });
    for(const e of entries){
      const p = path.join(d, e.name);
      if(e.isDirectory()) stack.push(p); else out.push(p);
    }
  }
  return out;
}

function idFromFilename(name){
  const m = name.match(RE);
  if(!m) return null;
  const level = m[1].toUpperCase();
  const num = String(parseInt(m[2],10)); // normalize 01 -> 1
  return `${level}-${num}`;
}

async function main(){
  await ensureDir(DATA_DIR);
  const files = await listFilesRecursive(DATA_DIR);

  const byLevel = Object.fromEntries(LEVELS.map(l=>[l, new Set()]));

  for(const file of files){
    const base = path.basename(file);
    const id = idFromFilename(base);
    if(id){
      const level = id.split('-')[0];
      byLevel[level].add(id);
    }
  }

  let total=0;
  for(const level of LEVELS){
    const arr = Array.from(byLevel[level]).sort((a,b)=>{
      const na = parseInt(a.split('-')[1],10);
      const nb = parseInt(b.split('-')[1],10);
      return na-nb;
    });
    const outPath = path.join(DATA_DIR, `index-${level}.json`);
    await fs.writeFile(outPath, JSON.stringify(arr, null, 2)+'\n', 'utf8');
    console.log(`Wrote ${outPath} (${arr.length} items)`);
    total += arr.length;
  }
  console.log(`Done. Total sentences indexed: ${total}`);
}

main().catch(err=>{
  console.error(err);
  process.exit(1);
});
