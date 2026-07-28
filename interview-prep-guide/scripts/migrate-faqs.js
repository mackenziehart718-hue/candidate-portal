#!/usr/bin/env node
/** Move FAQs from locations to index; strip FAQ from all location JSON. */
const fs = require('fs');
const path = require('path');
const { ROOT, contentPath, writeFile } = require('./lib/utils');

const indexPath = contentPath('index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

const locDir = contentPath('locations');
const files = fs.readdirSync(locDir).filter((f) => f.endsWith('.json'));

let faqs = null;
files.forEach((f) => {
  const file = path.join(locDir, f);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!faqs && data.faqs) faqs = data.faqs;
  delete data.faqs;
  if (Array.isArray(data.sectionOrder)) {
    data.sectionOrder = data.sectionOrder.filter((id) => id !== 'faq');
  }
  if (Array.isArray(data.nav)) {
    data.nav = data.nav.filter((n) => n.id !== 'faq');
  }
  if (!data.customSections) data.customSections = [];
  writeFile(file, JSON.stringify(data, null, 2) + '\n');
  console.log('Updated', f);
});

index.faqs = faqs || {
  label: 'Day-of',
  heading: 'FAQs',
  items: [],
};
if (!index.customSections) index.customSections = [];
if (!index.sectionOrder) index.sectionOrder = [];
if (!index.sectionOrder.includes('faq')) {
  const contactIdx = index.sectionOrder.indexOf('contact');
  if (contactIdx >= 0) index.sectionOrder.splice(contactIdx, 0, 'faq');
  else index.sectionOrder.push('faq');
}
index.locations.intro = index.locations.intro.replace(
  /, and day-of FAQs\.?/,
  '.'
).replace(/ and day-of FAQs/g, '');

writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log('Updated index.json with shared FAQs');
