#!/usr/bin/env node
/**
 * One-time migration: extract content from existing HTML into JSON files.
 * Run: node scripts/migrate.js
 */
const fs = require('fs');
const path = require('path');
const { ROOT, writeFile, contentPath, defaultFaqs, defaultRegistration, defaultContact } = require('./lib/utils');

function inner(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = html.match(re);
  return m ? m[1].trim() : '';
}

function match(html, re) {
  const m = html.match(re);
  return m && m[1] != null ? m[1].trim() : '';
}

function extractInfoBlocks(sectionHtml) {
  const blocks = [];
  const re = /<div class="info-block">([\s\S]*?)<\/div>\s*(?=<div class="info-block">|<\/div>\s*<\/div>\s*<\/section>)/g;
  let m;
  while ((m = re.exec(sectionHtml)) !== null) {
    const block = m[1];
    const icon = match(block, /<span class="info-icon">([^<]*)<\/span>/);
    const title = match(block, /<h3>([^<]*)<\/h3>/);
    const paragraphs = [];
    const ul = block.match(/<ul>([\s\S]*?)<\/ul>/);
    if (ul) {
      const items = [...ul[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1].trim());
      if (items.length) paragraphs.push({ type: 'list', items });
    }
    const ps = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((x) => x[1].trim());
    ps.forEach((p) => paragraphs.push({ type: 'html', html: p }));
    blocks.push({ icon, title, paragraphs });
  }
  return blocks;
}

function extractRegistration(sectionHtml) {
  const cards = [];
  const re = /<div class="card tip-card">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(sectionHtml)) !== null) {
    const card = m[1];
    const title = match(card, /<h3>([^<]*)<\/h3>/);
    const ps = [...card.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((x) => x[1].trim());
    const entry = { title, body: ps[0] || '' };
    if (ps[1]) entry.note = ps[1];
    cards.push(entry);
  }
  return cards;
}

function extractFaqs(sectionHtml) {
  const items = [];
  const re = /<details>\s*<summary>([^<]*)<\/summary>\s*<div class="answer">\s*([\s\S]*?)\s*<\/div>\s*<\/details>/g;
  let m;
  while ((m = re.exec(sectionHtml)) !== null) {
    items.push({ question: m[1].trim(), answer: m[2].trim().replace(/\s+/g, ' ') });
  }
  return items;
}

function extractSection(html, id) {
  const re = new RegExp(`<section id="${id}">([\\s\\S]*?)<\\/section>`);
  const m = html.match(re);
  return m ? m[1] : '';
}

function migrateLocation(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const slug = path.basename(filePath, '.html');
  const isVirtual = slug === 'virtual';

  const title = match(html, /<title>([^<]*)<\/title>/);
  const barLabel = match(html, /<span style="color: var\(--muted\); font-size: 0\.82rem;">([^<]*)<\/span>/);
  const heroEyebrow = match(html, /<p class="eyebrow">([^<]*)<\/p>/);
  const heroTitle = match(html, /<header class="hero[\s\S]*?<h1>([^<]*)<\/h1>/);
  const heroLead = match(html, /<header class="hero[\s\S]*?<p class="lead">([^<]*)<\/p>/);
  const heroPhoto = match(html, /<div class="hero-photo">([^<]*)<\/div>/);

  const addressSection = extractSection(html, 'address');
  const addressHtml = match(addressSection, /<div class="card address-card">\s*<p>([\s\S]*?)<\/p>/);
  const addressNote = match(addressSection, /<p style="margin-top: 0\.85rem[^"]*">([\s\S]*?)<\/p>/);
  const mapsUrl = match(addressSection, /<a href="([^"]*)"[^>]*>Open in Google Maps/);

  const nav = [];
  const navRe = /<a href="#([^"]+)">([^<]*)<\/a>/g;
  let nm;
  const navBlock = match(html, /<nav class="page-nav"[\s\S]*?<div class="page-nav-inner">([\s\S]*?)<\/div>/);
  while ((nm = navRe.exec(navBlock)) !== null) {
    nav.push({ id: nm[1], label: nm[2].replace(/&amp;/g, '&') });
  }

  const data = {
    slug,
    title,
    barLabel,
    hero: {
      eyebrow: heroEyebrow,
      title: heroTitle,
      lead: heroLead,
      photo: heroPhoto,
    },
    nav,
    address: {
      label: match(addressSection, /<p class="section-label">([^<]*)<\/p>/) || 'Where to go',
      heading: match(addressSection, /<h2>([^<]*)<\/h2>/) || 'Office address',
      addressHtml: addressHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<strong>/g, '**').replace(/<\/strong>/g, '**'),
      noteHtml: addressNote || '',
      mapsUrl: mapsUrl || '',
    },
    arrival: {
      label: 'When you arrive',
      heading: match(extractSection(html, 'arrival'), /<h2>([^<]*)<\/h2>/) || 'Getting to the lobby & check-in',
      blocks: extractInfoBlocks(extractSection(html, 'arrival')),
    },
    registration: {
      label: 'Required',
      heading: 'Registration',
      cards: extractRegistration(extractSection(html, 'registration')),
    },
    faqs: {
      label: 'Day-of',
      heading: 'FAQs',
      items: extractFaqs(extractSection(html, 'faq')),
    },
    contact: defaultContact(),
  };

  if (!data.registration.cards.length) data.registration = defaultRegistration();
  if (!data.faqs.items.length) data.faqs.items = defaultFaqs();

  if (isVirtual) {
    data.zoom = {
      label: match(extractSection(html, 'zoom'), /<p class="section-label">([^<]*)<\/p>/) || 'Before you join',
      heading: match(extractSection(html, 'zoom'), /<h2>([^<]*)<\/h2>/) || 'Zoom setup',
      blocks: extractInfoBlocks(extractSection(html, 'zoom')),
    };
    data.address.addressHtml = 'No physical address — join via the Zoom link in your calendar invite.';
    data.address.mapsUrl = '';
  } else {
    const transitSection = extractSection(html, 'transit');
    data.transit = {
      label: match(transitSection, /<p class="section-label">([^<]*)<\/p>/) || 'Getting here',
      heading: match(transitSection, /<h2>([^<]*)<\/h2>/) || 'Parking & public transportation',
      blocks: extractInfoBlocks(transitSection),
    };
  }

  // Fix address HTML back - keep as HTML in JSON
  const addrCard = match(addressSection, /<div class="card address-card">([\s\S]*?)<\/div>/);
  if (addrCard && !isVirtual) {
    const firstP = match(addrCard, /^<p>([\s\S]*?)<\/p>/);
    data.address.addressHtml = firstP;
    const notePs = [...addrCard.matchAll(/<p style="margin-top[^"]*">([\s\S]*?)<\/p>/g)].map((x) => x[1]);
    data.address.noteHtml = notePs.join('\n');
  }

  return data;
}

function migrateIndex() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  const prepSteps = [];
  const prepRe = /<li class="prep-item">[\s\S]*?<h3>([^<]*)<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
  let pm;
  while ((pm = prepRe.exec(html)) !== null) {
    prepSteps.push({ title: pm[1], body: pm[2].trim().replace(/\s+/g, ' ') });
  }

  const dressTips = [];
  const dressRe = /<div class="card tip-card">\s*<h3>([^<]*)<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
  let dm;
  const dressSection = extractSection(html, 'dress');
  while ((dm = dressRe.exec(dressSection)) !== null) {
    dressTips.push({ title: dm[1], body: dm[2].trim() });
  }

  const links = [];
  const linkRe = /<a class="resource-card" href="([^"]*)"[^>]*>[\s\S]*?<span class="icon">([^<]*)<\/span>[\s\S]*?<h3>([^<]*)<\/h3>\s*<p>([^<]*)<\/p>[\s\S]*?<span class="link-hint">([^<]*)<\/span>/g;
  let lm;
  while ((lm = linkRe.exec(html)) !== null) {
    links.push({ url: lm[1], icon: lm[2], title: lm[3], description: lm[4], hint: lm[5] });
  }

  const values = [];
  const valRe = /<span class="value-chip">([^<]*)<\/span>/g;
  let vm;
  const valuesSection = extractSection(html, 'values');
  while ((vm = valRe.exec(valuesSection)) !== null) {
    const v = vm[1];
    if (!values.includes(v)) values.push(v);
  }

  const locations = [];
  const locRe = /<a class="location-card([^"]*)" href="locations\/([^"]+)">[\s\S]*?<span class="loc-icon">([^<]*)<\/span>[\s\S]*?<h3>([^<]*)<\/h3>\s*<p>([^<]*)<\/p>/g;
  let locm;
  while ((locm = locRe.exec(html)) !== null) {
    locations.push({
      slug: locm[2].replace('.html', ''),
      virtual: locm[1].includes('virtual'),
      icon: locm[3],
      title: locm[4],
      subtitle: locm[5],
    });
  }

  const youtubeId = match(html, /youtube\.com\/embed\/([^"?]+)/) || 'VIDEO_ID_HERE';

  return {
    title: match(html, /<title>([^<]*)<\/title>/),
    siteBar: {
      logo: 'Box',
      title: 'Interview Prep',
      tagline: match(html, /For candidates with scheduled interviews/),
    },
    hero: {
      eyebrow: match(html, /<header class="hero">[\s\S]*?<p class="eyebrow">([^<]*)<\/p>/),
      heading: match(html, /<header class="hero">[\s\S]*?<h1>([^<]*)<\/h1>/),
      lead: match(html, /<header class="hero">[\s\S]*?<p class="lead">\s*([\s\S]*?)\s*<\/p>/).replace(/\s+/g, ' ').trim(),
    },
    welcome: {
      label: match(extractSection(html, 'welcome'), /<p class="section-label">([^<]*)<\/p>/),
      heading: match(extractSection(html, 'welcome'), /<h2>([^<]*)<\/h2>/),
      intro: match(extractSection(html, 'welcome'), /<p class="section-intro">\s*([\s\S]*?)\s*<\/p>/).replace(/\s+/g, ' '),
      calloutHtml: match(extractSection(html, 'welcome'), /<div class="callout callout-info">\s*([\s\S]*?)\s*<\/div>/),
      cardText: match(extractSection(html, 'welcome'), /<div class="card">\s*<p[^>]*>\s*([\s\S]*?)\s*<\/p>/).replace(/\s+/g, ' '),
    },
    prepare: {
      label: match(extractSection(html, 'prepare'), /<p class="section-label">([^<]*)<\/p>/),
      heading: match(extractSection(html, 'prepare'), /<h2>([^<]*)<\/h2>/),
      intro: match(extractSection(html, 'prepare'), /<p class="section-intro">([^<]*)<\/p>/),
      steps: prepSteps,
    },
    dress: {
      label: match(extractSection(html, 'dress'), /<p class="section-label">([^<]*)<\/p>/),
      heading: match(extractSection(html, 'dress'), /<h2>([^<]*)<\/h2>/),
      tips: dressTips,
    },
    links: {
      label: match(extractSection(html, 'links'), /<p class="section-label">([^<]*)<\/p>/),
      heading: match(extractSection(html, 'links'), /<h2>([^<]*)<\/h2>/),
      intro: match(extractSection(html, 'links'), /<p class="section-intro">([^<]*)<\/p>/),
      items: links,
    },
    video: {
      label: match(extractSection(html, 'video'), /<p class="section-label">([^<]*)<\/p>/),
      heading: match(extractSection(html, 'video'), /<h2>([^<]*)<\/h2>/),
      intro: match(extractSection(html, 'video'), /<p class="section-intro">([^<]*)<\/p>/),
      youtubeId,
      caption: 'Replace VIDEO_ID_HERE with your Aaron video embed ID before publishing.',
      iframeTitle: 'A message from Aaron Levie, Box CEO',
    },
    values: {
      label: match(extractSection(html, 'values'), /<p class="section-label">([^<]*)<\/p>/),
      heading: match(extractSection(html, 'values'), /<h2>([^<]*)<\/h2>/),
      intro: match(extractSection(html, 'values'), /<p class="section-intro">([^<]*)<\/p>/),
      items: values,
    },
    locations: {
      label: match(extractSection(html, 'locations'), /<p class="section-label">([^<]*)<\/p>/),
      heading: match(extractSection(html, 'locations'), /<h2>([^<]*)<\/h2>/),
      intro: match(extractSection(html, 'locations'), /<p class="section-intro">\s*([\s\S]*?)\s*<\/p>/).replace(/\s+/g, ' '),
      items: locations,
    },
    contact: {
      label: match(extractSection(html, 'contact'), /<p class="section-label">([^<]*)<\/p>/),
      heading: match(extractSection(html, 'contact'), /<h2>([^<]*)<\/h2>/),
      body: match(extractSection(html, 'contact'), /<div class="contact-bar">\s*<p>\s*([\s\S]*?)\s*<\/p>/).replace(/\s+/g, ' '),
      email: match(extractSection(html, 'contact'), /href="mailto:([^"]+)"/),
      buttonText: match(extractSection(html, 'contact'), /<a class="btn"[^>]*>([^<]*)<\/a>/),
    },
    footer: {
      year: 2026,
      careersUrl: 'https://careers.box.com/en/',
      note: 'This page is for candidates with scheduled interviews only.',
    },
  };
}

// Run migration
writeFile(contentPath('index.json'), JSON.stringify(migrateIndex(), null, 2) + '\n');

const locDir = path.join(ROOT, 'locations');
fs.readdirSync(locDir)
  .filter((f) => f.endsWith('.html'))
  .forEach((f) => {
    const data = migrateLocation(path.join(locDir, f));
    writeFile(contentPath('locations', f.replace('.html', '.json')), JSON.stringify(data, null, 2) + '\n');
    console.log('Migrated', f);
  });

console.log('Migration complete → content/');
