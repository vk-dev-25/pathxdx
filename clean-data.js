#!/usr/bin/env node
/**
 * Clean data.json:
 * 1. Keep only rows where tab (index 7) is "Sheet1"
 * 2. Remove rows where Primary Diagnosis (index 4) is "-", "empty", or contains "Error"
 */

const fs = require('fs');

function isBadPrimaryDiagnosis(val) {
  if (val == null) return true;
  const d = String(val).trim();
  const dLower = d.toLowerCase();
  if (d === '' || d === '-' || dLower === 'empty') return true;
  if (d === '\u2014' || d === '—' || d === '\u2013' || d === '–') return true; // em dash, en dash
  if (/^[\s\-–—\u2013\u2014]+$/i.test(d)) return true; // only dashes/whitespace
  if (dLower.includes('error')) return true;
  return false;
}

console.log('Reading data.json...');
const raw = fs.readFileSync('data.json', 'utf8');
const data = JSON.parse(raw);
console.log('Total rows:', data.length);

// Keep only Sheet1
const sheet1Only = data.filter(r => r[7] === 'Sheet1');
console.log('After keeping only Sheet1:', sheet1Only.length);

// Remove bad Primary Diagnosis (index 4)
const cleaned = sheet1Only.filter(r => !isBadPrimaryDiagnosis(r[4]));
console.log('After removing bad Primary Diagnosis:', cleaned.length);
console.log('Removed:', sheet1Only.length - cleaned.length);

console.log('Writing updated data.json...');
fs.writeFileSync('data.json', JSON.stringify(cleaned), 'utf8');
console.log('Done.');
