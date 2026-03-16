#!/usr/bin/env node
/**
 * Add Catalog ID to each row: PTDX-{2 char tissue abbr}-{random 7-digit number}
 * Number is random and unique within each tissue type (range 1000000–9999999).
 * Writes catalog ID as 9th element (index 8) of each row.
 */

const fs = require('fs');

const MIN_NUM = 1000000;
const MAX_NUM = 9999999;

function uniqueRandoms(count) {
  const set = new Set();
  while (set.size < count) {
    set.add(MIN_NUM + Math.floor(Math.random() * (MAX_NUM - MIN_NUM + 1)));
  }
  return [...set];
}

const TISSUE_ABBR = {
  'Adenoids': 'AD', 'Adrenal Gland': 'AG', 'Anus': 'AN', 'Appendix': 'AP', 'Artery': 'AR',
  'Bile Duct': 'BD', 'Bladder': 'BL', 'Body Cavity': 'BC', 'Bone': 'BO', 'Bone Marrow': 'BM',
  'Brain': 'BR', 'Breast': 'BX', 'Bronchus': 'BN', 'Bursa': 'BU', 'Cecum': 'CE',
  'Cerebrospinal Fluid': 'CF', 'Cervix': 'CX', 'Cervix/Endocervix': 'CZ', 'Colon': 'CO',
  'Conjunctiva': 'CJ', 'Cyst': 'CY', 'Ear': 'EA', 'Endocervix': 'EN', 'Endometrium': 'EM',
  'Epididymis': 'EP', 'Esophagus': 'ES', 'Extremity': 'EX', 'Eye': 'EY', 'Fallopian Tube': 'FT',
  'Fetus': 'FE', 'Finger': 'FI', 'Gallbladder': 'GB', 'Gastric': 'GA', 'Heart': 'HE',
  'Hemorrhoids': 'HM', 'Hernia': 'HN', 'Intervertebral Disk': 'ID', 'Joint': 'JO',
  'Kidney': 'KI', 'Larynx': 'LA', 'Liver': 'LI', 'Lung': 'LU', 'Lymph Node': 'LN',
  'Muscle': 'MU', 'Nasal Tissue': 'NT', 'Nasopharynx': 'NP', 'Nerve': 'NE', 'Omentum': 'OM',
  'Oral': 'OR', 'Ovary': 'OV', 'Ovary and Fallopian Tube': 'OF', 'Pancreas': 'PA',
  'Parathyroid': 'PY', 'Penis': 'PN', 'Peripheral Blood': 'PB', 'Peritoneum': 'PO',
  'Pharynx': 'PH', 'Placenta': 'PL', 'Pleura': 'PR', 'Prostate': 'PS', 'Rectum': 'RE',
  'Renal': 'RN', 'Retroperitoneum': 'RP', 'Salivary Gland': 'SG', 'Seminal Vesicle': 'SV',
  'Sinus': 'SI', 'Skin': 'SK', 'Small Intestine': 'SM', 'Soft Tissue': 'ST', 'Spleen': 'SP',
  'Sputum': 'SU', 'Stomach': 'SO', 'Submandibular': 'SB', 'Tendon': 'TE', 'Testis': 'TS',
  'Thyroid': 'TH', 'Tongue': 'TO', 'Tonsil': 'TN', 'Trachea': 'TR', 'Ureter': 'UR',
  'Urethra': 'UH', 'Urine': 'UN', 'Uterine Contents': 'UC', 'Uterus': 'UT', 'Uvula': 'UV',
  'Vagina': 'VA', 'Vas Deferens': 'VD', 'Vein': 'VE', 'Vertebral Column': 'VC',
  'Vocal Cord': 'VO', 'Vulva': 'VV',
};

console.log('Reading data.json...');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
console.log('Rows:', data.length);

// Count per tissue
const tissueCount = {};
data.forEach((r) => {
  const t = String(r[3] || '').trim();
  tissueCount[t] = (tissueCount[t] || 0) + 1;
});

// For each tissue, generate unique random numbers (7-digit: 1000000–9999999)
const tissueRandoms = {};
for (const [tissue, count] of Object.entries(tissueCount)) {
  tissueRandoms[tissue] = uniqueRandoms(count);
}

// Assign catalog IDs (consume one random per row per tissue, in file order)
const tissueIndex = {};
const out = data.map((r) => {
  const tissue = String(r[3] || '').trim();
  const abbr = TISSUE_ABBR[tissue] || 'XX';
  tissueIndex[tissue] = tissueIndex[tissue] || 0;
  const num = tissueRandoms[tissue][tissueIndex[tissue]++];
  const catalogId = `PTDX-${abbr}-${num}`;
  const row = r.slice(0, 8);
  row[8] = catalogId;
  return row;
});

console.log('Sample catalog IDs:', out.slice(0, 5).map((r) => r[8]));
console.log('Writing data.json with Catalog IDs...');
fs.writeFileSync('data.json', JSON.stringify(out), 'utf8');
console.log('Done.');