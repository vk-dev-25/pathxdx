#!/usr/bin/env node
/**
 * Build public availability catalog (range format) from specimen data.json.
 * Matches PathXDx FFPE Availability Catalog columns:
 *   Organ / tissue, Normal / control, Benign, Pre-malignant, Malignant,
 *   Total cases, of which inflammatory / infectious, Age at collection, Sex split
 *
 * Unknown category is excluded from public counts. Source data.json is never modified.
 *
 * Usage: node build-counts.js [path/to/data.json]
 */
const fs = require('fs');
const path = require('path');

const PUBLIC_CATS = ['Normal/Control', 'Benign', 'Pre-malignant', 'Malignant'];
const NON_TISSUE = new Set([
  'Body Cavity',
  'Bone Marrow',
  'Cerebrospinal Fluid',
  'Peripheral Blood',
  'Sputum',
  'Urine',
]);

const RANGES = [
  { max: 0, label: '-' },
  { max: 4, label: '<5' },
  { max: 25, label: '5-25' },
  { max: 100, label: '25-100' },
  { max: 250, label: '100-250' },
  { max: 500, label: '250-500' },
  { max: 1000, label: '500-1,000' },
  { max: 2500, label: '1,000-2,500' },
  { max: 5000, label: '2,500-5,000' },
  { max: 10000, label: '5,000-10,000' },
  { max: Infinity, label: '10,000+' },
];

const INFLAM_RE =
  /\b(inflam|infection|infectious|infective|abscess|sepsis|septic|viral|bacterial|fungal|mycobacter|tubercul|gastritis|colitis|hepatitis|pneumonia|bronchitis|cystitis|prostatitis|cervicitis|endometritis|salpingitis|oophoritis|pyelonephritis|nephritis|dermatitis|cellulitis|osteomyelitis|peritonitis|pleuritis|sinusitis|tonsillitis|pharyngitis|cholecystitis|pancreatitis|appendicitis|orchitis|epididymitis|urethritis|vulvitis|vaginitis|chorioamnionitis|diverticulitis|enteritis|duodenitis|esophagitis|sialadenitis|thyroiditis|myocarditis|pericarditis|vasculitis|arthritis|bursitis|conjunctivitis|keratitis|uveitis|meningitis|encephalitis|mastitis|folliculitis|hidradenitis|panniculitis|pyoderma|osteitis|osteomyelitis|osteochondritis)\b/i;

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

function toRange(n) {
  for (const r of RANGES) {
    if (n <= r.max) return r.label;
  }
  return '10,000+';
}

function calcAge(dob) {
  if (!dob || dob === 'nan') return null;
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const a = Math.floor((new Date('2024-01-01') - d) / 31557600000);
  if (!(a > 0 && a < 120)) return null;
  return a >= 90 ? 90 : a; // 90+ bucket for display capping
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function formatAge(ages) {
  if (!ages.length) return '—';
  const sorted = [...ages].sort((a, b) => a - b);
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  const med = median(sorted);
  const loS = lo === 90 ? '90+' : String(lo);
  const hiS = hi === 90 ? '90+' : String(hi);
  const medS = med === 90 ? '90+' : String(med);
  return `${loS}-${hiS} (median ${medS})`;
}

function formatSex(f, m) {
  const t = f + m;
  if (!t) return '—';
  if (m === 0) return 'Female';
  if (f === 0) return 'Male';
  const fp = Math.round((f / t) * 100);
  const mp = 100 - fp;
  return `${fp}% F / ${mp}% M`;
}

function emptyBucket() {
  return {
    'Normal/Control': 0,
    Benign: 0,
    'Pre-malignant': 0,
    Malignant: 0,
    inflammatory: 0,
    ages: [],
    f: 0,
    m: 0,
  };
}

const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
const byTissue = {};
let skippedUnknown = 0;

for (const r of raw) {
  const cat = r[6];
  if (!PUBLIC_CATS.includes(cat)) {
    skippedUnknown++;
    continue;
  }
  const tissue = r[3] || 'Unknown tissue';
  if (!byTissue[tissue]) byTissue[tissue] = emptyBucket();
  const b = byTissue[tissue];
  b[cat]++;

  const diag = `${r[4] || ''} ${r[5] || ''}`;
  if (INFLAM_RE.test(diag)) b.inflammatory++;

  const age = calcAge(r[1]);
  if (age != null) b.ages.push(age);

  if (r[2] === 'F') b.f++;
  else if (r[2] === 'M') b.m++;
}

function rowFrom(tissue, b) {
  const total =
    b['Normal/Control'] + b.Benign + b['Pre-malignant'] + b.Malignant;
  return {
    tissue,
    'Normal/Control': toRange(b['Normal/Control']),
    Benign: toRange(b.Benign),
    'Pre-malignant': toRange(b['Pre-malignant']),
    Malignant: toRange(b.Malignant),
    total: toRange(total),
    inflammatory: toRange(b.inflammatory),
    age: formatAge(b.ages),
    sex: formatSex(b.f, b.m),
    // exact totals for sorting / filters (not shown as exact on public UI)
    _totalExact: total,
    _malignantExact: b.Malignant,
  };
}

function buildRows(names) {
  return names
    .map((t) => rowFrom(t, byTissue[t]))
    .filter((r) => r._totalExact > 0)
    .sort((a, b) => b._totalExact - a._totalExact || a.tissue.localeCompare(b.tissue));
}

const tissueNames = Object.keys(byTissue).filter((t) => !NON_TISSUE.has(t));
const nonTissueNames = Object.keys(byTissue).filter((t) => NON_TISSUE.has(t));

const rows = buildRows(tissueNames);
const nonTissueRows = buildRows(nonTissueNames);

const exactTotal = rows.reduce((s, r) => s + r._totalExact, 0);
const malignantExact = rows.reduce((s, r) => s + r._malignantExact, 0);

const payload = {
  version: 3,
  format: 'availability-by-organ-ranges',
  generatedAt: new Date().toISOString().slice(0, 10),
  title: 'PathXDx FFPE Archive — availability by organ and diagnostic category',
  subtitle: "Case ranges. '<5' indicates limited material — please enquire.",
  totalBlocks: exactTotal,
  tissueTypes: rows.length,
  totalBlocksDisplay: toRange(exactTotal),
  malignantDisplay: toRange(malignantExact),
  columns: [
    'Organ / tissue',
    'Normal / control',
    'Benign',
    'Pre-malignant',
    'Malignant',
    'Total cases',
    'of which inflammatory / infectious',
    'Age at collection',
    'Sex split',
  ],
  rows: rows.map(({ _totalExact, _malignantExact, ...pub }) => pub),
  nonTissueRows: nonTissueRows.map(({ _totalExact, _malignantExact, ...pub }) => pub),
  nonTissueNote:
    'Non-tissue specimen types held separately (not FFPE blocks): ' +
    [...NON_TISSUE].join(', '),
  footnotes: [
    "Case ranges. '<5' indicates limited material — please enquire.",
    'Inflammatory / infectious counts overlap the categories to their left and are not additive.',
    'Counts exclude the Unknown diagnostic category.',
  ],
};

fs.writeFileSync(out, JSON.stringify(payload));
console.log(
  `Wrote ${out}: ${rows.length} organs, ${exactTotal.toLocaleString()} cases (excl. Unknown ${skippedUnknown.toLocaleString()}); ${nonTissueRows.length} non-tissue types`
);
