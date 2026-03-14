#!/usr/bin/env node
/**
 * Clean data.json:
 * 1. Keep only rows where tab (index 7) is "Sheet1"
 * 2. Remove rows where Primary Diagnosis (index 4) is "-", "empty", or contains "Error"
 * 3. Remove rows where Primary Diagnosis contains any excluded diagnosis phrases
 */

const fs = require('fs');

const EXCLUDED_DIAGNOSIS_PHRASES = [
  'No Specimen Received',
  'No Tissue Found In Specimen Container',
  'No Tissue Present',
  'Tissue Lost in Processing',
  'AMENDED REPORT:',
  'Texas Case',
  'Free Text Diagnosis, See Comments',
];

const EXCLUDED_TISSUES = new Set([
  'Fluid', 'Medical Device', 'Calculus', 'Other', 'Nail', 'Mediastinum',
  'SurePath Send Out', 'Products of Conception', 'FNA', 'Foreign Body',
  'Graft', 'Lip', 'Teeth', 'Toe',
]);

function isBadPrimaryDiagnosis(val) {
  if (val == null) return true;
  const d = String(val).trim();
  const dLower = d.toLowerCase();
  if (d === '' || d === '-' || dLower === 'empty') return true;
  if (d === '\u2014' || d === '—' || d === '\u2013' || d === '–') return true; // em dash, en dash
  if (/^[\s\-–—\u2013\u2014]+$/i.test(d)) return true; // only dashes/whitespace
  if (dLower.includes('error')) return true;
  // Exclude if contains any of the diagnosis phrases (case-insensitive)
  for (const phrase of EXCLUDED_DIAGNOSIS_PHRASES) {
    if (dLower.includes(phrase.toLowerCase())) return true;
  }
  return false;
}

console.log('Reading data.json...');
const raw = fs.readFileSync('data.json', 'utf8');
const data = JSON.parse(raw);
console.log('Total rows:', data.length);

// Keep only Sheet1
const sheet1Only = data.filter(r => r[7] === 'Sheet1');
console.log('After keeping only Sheet1:', sheet1Only.length);

// Remove rows where Tissue (index 3) is in EXCLUDED_TISSUES
const tissueTrim = (v) => String(v || '').trim();
const afterTissue = sheet1Only.filter(r => !EXCLUDED_TISSUES.has(tissueTrim(r[3])));
if (afterTissue.length !== sheet1Only.length) console.log('Removed excluded tissues:', sheet1Only.length - afterTissue.length, 'rows');

// Remove bad Primary Diagnosis (index 4)
let cleaned = afterTissue.filter(r => !isBadPrimaryDiagnosis(r[4]));
console.log('After removing bad Primary Diagnosis:', cleaned.length);
console.log('Removed (bad diagnosis):', afterTissue.length - cleaned.length);

// Transform: "Technical Processing Only" or "Technical Component Only" -> "Normal*", and Unknown -> "Normal/Control"
function isTechnicalProcessingOnly(diag) {
  const d = diag.toLowerCase();
  return d.includes('technical') && d.includes('processing only');
}
function isTechnicalComponentOnly(diag) {
  const d = diag.toLowerCase();
  return d.includes('technical') && d.includes('component only');
}
function isSpecimenReceivedForTechnicalProcessingOnly(diag) {
  const d = diag.toLowerCase();
  return (d.includes('received for technical processing only') ||
    (d.includes('specimen is received for technical processing') && d.includes('returned to')));
}
let transformCount = 0;
cleaned = cleaned.map(r => {
  const diag = (r[4] && String(r[4]).trim()) || '';
  if (isTechnicalProcessingOnly(diag) || isTechnicalComponentOnly(diag) || isSpecimenReceivedForTechnicalProcessingOnly(diag)) {
    transformCount++;
    const out = [...r];
    out[4] = 'Normal*';
    if (String(r[6] || '').trim().toLowerCase() === 'unknown') {
      out[6] = 'Normal/Control';
    }
    return out;
  }
  return r;
});
if (transformCount) console.log('Transformed "Technical Processing/Component Only" -> Normal* (Unknown -> Normal/Control):', transformCount, 'rows');

console.log('Writing updated data.json...');
fs.writeFileSync('data.json', JSON.stringify(cleaned), 'utf8');
console.log('Done.');
