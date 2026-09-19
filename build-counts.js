#!/usr/bin/env node
/**
 * Build public aggregate counts from specimen data.json.
 * Public site should only ship counts.json — never specimen-level fields.
 * Unknown category is excluded from public counts and totals.
 *
 * Usage: node build-counts.js [path/to/data.json]
 * Default input: pathxinternalview/data.json (falls back to ./data.json)
 */
const fs = require('fs');
const path = require('path');

const PUBLIC_CATS = ['Malignant', 'Benign', 'Normal/Control', 'Pre-malignant'];
const SMALL_CELL = 5;

const input =
  process.argv[2] ||
  (fs.existsSync('pathxinternalview/data.json')
    ? 'pathxinternalview/data.json'
    : 'data.json');
const out = path.join(path.dirname(__filename), 'counts.json');

if (!fs.existsSync(input)) {
  console.error('Missing input:', input);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
const byTissue = {};
let skippedUnknown = 0;

for (const r of raw) {
  const tissue = r[3] || 'Unknown tissue';
  const cat = r[6];
  if (!PUBLIC_CATS.includes(cat)) {
    skippedUnknown++;
    continue;
  }
  if (!byTissue[tissue]) {
    byTissue[tissue] = Object.fromEntries(PUBLIC_CATS.map((c) => [c, 0]));
  }
  byTissue[tissue][cat]++;
}

function displayCount(n) {
  if (n === 0) return 0;
  if (n < SMALL_CELL) return '<5';
  return n;
}

const rows = Object.keys(byTissue)
  .sort((a, b) => a.localeCompare(b))
  .map((tissue) => {
    const counts = byTissue[tissue];
    const total = PUBLIC_CATS.reduce((s, c) => s + counts[c], 0);
    const outRow = { tissue, total: displayCount(total) };
    for (const c of PUBLIC_CATS) outRow[c] = displayCount(counts[c]);
    return outRow;
  });

const exactTotal = Object.values(byTissue).reduce(
  (s, t) => s + PUBLIC_CATS.reduce((a, c) => a + t[c], 0),
  0
);
const tissueTypes = rows.length;
const categoryTotals = Object.fromEntries(
  PUBLIC_CATS.map((c) => {
    const n = Object.values(byTissue).reduce((s, t) => s + t[c], 0);
    return [c, displayCount(n)];
  })
);

const payload = {
  version: 2,
  generatedAt: new Date().toISOString().slice(0, 10),
  totalBlocks: exactTotal >= SMALL_CELL ? exactTotal : displayCount(exactTotal),
  tissueTypes,
  categories: PUBLIC_CATS,
  categoryTotals,
  rows,
  note: 'Counts exclude the Unknown category. Counts below 5 are shown as <5 to limit small-cell disclosure.',
};

fs.writeFileSync(out, JSON.stringify(payload));
console.log(
  `Wrote ${out}: ${tissueTypes} tissues, ${exactTotal.toLocaleString()} blocks (excluded ${skippedUnknown.toLocaleString()} Unknown)`
);
