// Generate index manifests for sentence JSON files.
// Usage: node scripts/gen-manifests.js [--max 10] or [--max=10]
// It scans public/data for files like:
//   sentences-A2-1.json, sentences-A2-01.json, sentences-B1-9.json, ...
// and writes:
//   public/data/index-A2.json, index-B1.json, index-B2.json

const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const LEVELS = ['A2', 'B1', 'B2'];

function parseMaxArg(argv) {
  const i = argv.findIndex((a) => a === '--max' || a.startsWith('--max='));
  if (i === -1) return null;
  const raw = argv[i].includes('=') ? argv[i].split('=')[1] : argv[i + 1];
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

const MAX_LIMIT = parseMaxArg(process.argv);

const RE_PLAIN = /^sentences-(A2|B1|B2)-(\d{1,3})\.json$/i; // sentences-A2-7.json, -12.json, -120.json
const RE_PAD   = /^sentences-(A2|B1|B2)-0(\d{1,2})\.json$/i; // sentences-A2-01.json, -09.json

async function listFilesRecursive(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFilesRecursive(p)));
    else out.push(p);
  }
  return out;
}

function normId(level, n) {
  return `${level}-${parseInt(String(n), 10)}`; // drop leading zeros
}

(async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const files = await listFilesRecursive(DATA_DIR);

  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, new Set()]));

  for (const file of files) {
    const base = path.basename(file);
    let m = base.match(RE_PLAIN);
    if (!m) m = base.match(RE_PAD);
    if (!m) continue;
    const level = m[1].toUpperCase();
    const num = parseInt(m[2], 10);
    if (!Number.isFinite(num)) continue;
    if (MAX_LIMIT && num > MAX_LIMIT) continue;
    byLevel[level].add(normId(level, num));
  }

  let total = 0;
  for (const level of LEVELS) {
    const arr = Array.from(byLevel[level]).sort((a, b) => parseInt(a.split('-')[1], 10) - parseInt(b.split('-')[1], 10));
    const outPath = path.join(DATA_DIR, `index-${level}.json`);
    await fs.writeFile(outPath, JSON.stringify(arr, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${outPath} (${arr.length} items)`);
    total += arr.length;
  }
  console.log(`Done. Total sentences indexed: ${total}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
