#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ROOT, esc, readJson, writeFile, contentPath } = require('./lib/utils');
const {
  getIndexSectionOrder,
  getLocationSectionOrder,
  buildIndexNav,
  buildLocationNav,
  customSectionId,
  getIndexCustomSections,
  getLocationCustomSections,
} = require('./lib/sections');

const HERO_SVG = `<svg viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="40" y="60" width="240" height="160" rx="12" fill="rgba(255,255,255,0.1)" stroke="rgba(145,194,253,0.5)" stroke-width="2"/>
          <circle cx="160" cy="120" r="36" fill="rgba(0,175,240,0.35)"/>
          <path d="M130 155 Q160 175 190 155" stroke="#91C2FD" stroke-width="3" fill="none" stroke-linecap="round"/>
          <rect x="70" y="200" width="80" height="8" rx="4" fill="rgba(255,255,255,0.35)"/>
          <rect x="70" y="215" width="120" height="6" rx="3" fill="rgba(255,255,255,0.2)"/>
          <circle cx="250" cy="80" r="24" fill="rgba(252,86,255,0.45)"/>
          <circle cx="70" cy="100" r="16" fill="rgba(36,193,127,0.4)"/>
          <circle cx="280" cy="200" r="18" fill="rgba(244,178,25,0.45)"/>
        </svg>`;

function renderParagraphs(block) {
  return (block.paragraphs || [])
    .map((p) => {
      if (p.type === 'list') {
        const items = p.items.map((i) => `<li>${i}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      const margin = p.margin ? ` style="${p.margin}"` : p.html && p.html.includes('margin-top') ? '' : '';
      if (p.type === 'html') {
        const html = p.html || '';
        if (/<p[\s>]|ul|ol|li|div|br/i.test(html)) return html;
        return `<p${margin}>${html}</p>`;
      }
      return `<p>${esc(p.text)}</p>`;
    })
    .join('\n            ');
}

function renderInfoBlocks(blocks) {
  return (blocks || [])
    .map(
      (b) => `        <div class="info-block">
          <span class="info-icon">${b.icon || '📍'}</span>
          <div>
            <h3>${b.title || ''}</h3>
            ${renderParagraphs(b)}
          </div>
        </div>`
    )
    .join('\n');
}

function renderInfoSection(id, section) {
  if (!section) return '';
  return `
    <section id="${id}">
      <p class="section-label">${esc(section.label)}</p>
      <h2>${esc(section.heading)}</h2>
      <div class="card">
${renderInfoBlocks(section.blocks)}
      </div>
    </section>`;
}

function renderCustomSection(entry) {
  const domId = `custom-${entry.id}`;
  const blocks = renderInfoBlocks(entry.blocks || []);
  const intro = entry.intro
    ? `      <p class="section-intro">${entry.intro}</p>\n`
    : '';
  const body = blocks
    ? `      <div class="card">\n${blocks}\n      </div>`
    : entry.bodyHtml
      ? `      <div class="card"><p>${entry.bodyHtml}</p></div>`
      : '';
  return `
    <section id="${domId}">
      <p class="section-label">${esc(entry.label)}</p>
      <h2>${esc(entry.heading)}</h2>
${intro}${body}
    </section>`;
}

function renderFaqSection(faqs) {
  if (!faqs?.items?.length) return '';
  const items = faqs.items
    .map(
      (f) => `      <details>
        <summary>${esc(f.question)}</summary>
        <div class="answer">
          ${f.answer}
        </div>
      </details>`
    )
    .join('\n');
  return `
    <section id="faq">
      <p class="section-label">${esc(faqs.label)}</p>
      <h2>${esc(faqs.heading)}</h2>

${items}
    </section>`;
}

function buildIndex(data) {
  const prepItems = data.prepare.steps
    .map(
      (s, i) => `        <li class="prep-item">
          <span class="prep-num">${i + 1}</span>
          <div>
            <h3>${esc(s.title)}</h3>
            <div class="rich-body">${s.body}</div>
          </div>
        </li>`
    )
    .join('\n');

  const dressCards = data.dress.tips
    .map(
      (t) => `        <div class="card tip-card">
          <h3>${esc(t.title)}</h3>
          <div class="tip-body">${t.body}</div>
        </div>`
    )
    .join('\n');

  const linkCards = data.links.items
    .map(
      (l) => `        <a class="resource-card" href="${esc(l.url)}" target="_blank" rel="noopener">
          <span class="icon">${l.icon}</span>
          <h3>${esc(l.title)}</h3>
          <p>${esc(l.description)}</p>
          <span class="link-hint">${esc(l.hint)}</span>
        </a>`
    )
    .join('\n');

  const valueChips = [...data.values.items, ...data.values.items]
    .map((v, i) => {
      const comment = i === data.values.items.length ? '\n          <!-- duplicate set for seamless loop -->' : '';
      return `${comment}
          <span class="value-chip">${esc(v)}</span>`;
    })
    .join('');

  const locationCards = data.locations.items
    .map((l) => {
      const virtualClass = l.virtual ? ' virtual' : '';
      return `        <a class="location-card${virtualClass}" href="locations/${esc(l.slug)}.html">
          <span class="loc-icon">${l.icon}</span>
          <h3>${esc(l.title)}</h3>
          <p>${esc(l.subtitle)}</p>
          <span class="arrow">View instructions →</span>
        </a>`;
    })
    .join('\n');

  const videoCaption = data.video.youtubeId === 'VIDEO_ID_HERE'
    ? `<p class="video-caption">Replace <code>VIDEO_ID_HERE</code> with your Aaron video embed ID before publishing.</p>`
    : '';

  const sectionOrder = getIndexSectionOrder(data);
  const navLinks = buildIndexNav(sectionOrder, data);
  const customById = Object.fromEntries(getIndexCustomSections(data).map((s) => [customSectionId(s), s]));

  const sectionHtml = {
    welcome: `
    <section id="welcome">
      <p class="section-label">${esc(data.welcome.label)}</p>
      <h2>${esc(data.welcome.heading)}</h2>
      <p class="section-intro">
        ${data.welcome.intro}
      </p>
      <div class="callout callout-info">
        ${data.welcome.calloutHtml}
      </div>
      <div class="card">
        <p style="color: var(--muted); font-size: 0.93rem;">
          ${data.welcome.cardText}
        </p>
      </div>
    </section>`,

    prepare: `
    <section id="prepare">
      <p class="section-label">${esc(data.prepare.label)}</p>
      <h2>${esc(data.prepare.heading)}</h2>
      <p class="section-intro">${esc(data.prepare.intro)}</p>

      <ol class="prep-list">
${prepItems}
      </ol>
    </section>`,

    dress: `
    <section id="dress">
      <p class="section-label">${esc(data.dress.label)}</p>
      <h2>${esc(data.dress.heading)}</h2>
      <div class="tips-grid">
${dressCards}
      </div>
    </section>`,

    links: `
    <section id="links">
      <p class="section-label">${esc(data.links.label)}</p>
      <h2>${esc(data.links.heading)}</h2>
      <p class="section-intro">${esc(data.links.intro)}</p>
      <div class="card-grid">
${linkCards}
      </div>
    </section>`,

    video: `
    <section id="video">
      <p class="section-label">${esc(data.video.label)}</p>
      <h2>${esc(data.video.heading)}</h2>
      <p class="section-intro">${esc(data.video.intro)}</p>
      <div class="video-wrap">
        <iframe
          src="https://www.youtube.com/embed/${esc(data.video.youtubeId)}"
          title="${esc(data.video.iframeTitle)}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
      ${videoCaption}
    </section>`,

    values: `
    <section id="values" class="values-section">
      <p class="section-label">${esc(data.values.label)}</p>
      <h2>${esc(data.values.heading)}</h2>
      <p class="section-intro">${esc(data.values.intro)}</p>
      <div class="values-track" aria-label="Box company values">
        <div class="values-wheel">${valueChips}
        </div>
      </div>
    </section>`,

    locations: `
    <section id="locations">
      <p class="section-label">${esc(data.locations.label)}</p>
      <h2>${esc(data.locations.heading)}</h2>
      <p class="section-intro">
        ${data.locations.intro}
      </p>

      <div class="card-grid">
${locationCards}
      </div>
    </section>`,

    contact: `
    <section id="contact">
      <p class="section-label">${esc(data.contact.label)}</p>
      <h2>${esc(data.contact.heading)}</h2>
      <div class="contact-bar">
        <p>
          ${data.contact.body}
        </p>
        <a class="btn" href="mailto:${esc(data.contact.email)}">${esc(data.contact.buttonText)}</a>
      </div>
    </section>`,

    faq: renderFaqSection(data.faqs),
  };

  const mainSections = sectionOrder
    .map((id) => {
      if (id.startsWith('custom:')) return renderCustomSection(customById[id] || {});
      return sectionHtml[id] || '';
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${esc(data.title)}</title>
  <link rel="stylesheet" href="css/site.css" />
</head>
<body>

  <div class="site-bar">
    <div class="site-bar-inner">
      <div class="logo"><span>${esc(data.siteBar.logo)}</span> ${esc(data.siteBar.title)}</div>
      <span style="color: var(--muted); font-size: 0.82rem;">${esc(data.siteBar.tagline)}</span>
    </div>
  </div>

  <header class="hero">
    <div class="hero-inner">
      <div class="hero-text">
        <p class="eyebrow">${esc(data.hero.eyebrow)}</p>
        <h1>${esc(data.hero.heading)}</h1>
        <p class="lead">
          ${data.hero.lead}
        </p>
      </div>
      <div class="hero-graphic" aria-hidden="true">
        ${HERO_SVG}
      </div>
    </div>
  </header>

  <nav class="page-nav" aria-label="Page sections">
    <div class="page-nav-inner">
${navLinks}
    </div>
  </nav>

  <main>
${mainSections}
  </main>

  <footer>
    <p>© ${data.footer.year} Box · <a href="${esc(data.footer.careersUrl)}">Careers</a></p>
    <p style="margin-top: 0.4rem;">${esc(data.footer.note)}</p>
  </footer>

</body>
</html>
`;
}

function buildLocation(data) {
  const sectionOrder = getLocationSectionOrder(data);
  const navLinks = buildLocationNav(sectionOrder, data);
  const customById = Object.fromEntries(getLocationCustomSections(data).map((s) => [customSectionId(s), s]));

  const addressNote = data.address.noteHtml
    ? `        <p style="margin-top: 0.85rem; font-size: 0.9rem; color: var(--muted);">
          ${data.address.noteHtml}
        </p>`
    : '';

  const mapsLink = data.address.mapsUrl
    ? `        <p style="margin-top: 0.75rem;">
          <a href="${esc(data.address.mapsUrl)}" target="_blank" rel="noopener">Open in Google Maps →</a>
        </p>`
    : '';

  const regCards = (data.registration.cards || [])
    .map((c) => {
      const note = c.note
        ? `\n          <p style="margin-top: 0.5rem; font-size: 0.87rem; color: var(--muted);">${c.note}</p>`
        : '';
      return `        <div class="card tip-card">
          <h3>${esc(c.title)}</h3>
          <div class="tip-body">${c.body}</div>${note}
        </div>`;
    })
    .join('\n');

  const transitSection = data.transit
    ? `
    <section id="transit">
      <p class="section-label">${esc(data.transit.label)}</p>
      <h2>${esc(data.transit.heading)}</h2>
      <div class="card">
${renderInfoBlocks(data.transit.blocks)}
      </div>
    </section>`
    : '';

  const zoomSection = data.zoom
    ? `
    <section id="zoom">
      <p class="section-label">${esc(data.zoom.label)}</p>
      <h2>${esc(data.zoom.heading)}</h2>
      <div class="card">
${renderInfoBlocks(data.zoom.blocks)}
      </div>
    </section>`
    : '';

  const sectionHtml = {
    address: `
    <section id="address">
      <p class="section-label">${esc(data.address.label)}</p>
      <h2>${esc(data.address.heading)}</h2>
      <div class="card address-card">
        <p>
          ${data.address.addressHtml}
        </p>
${addressNote}
${mapsLink}
      </div>
    </section>`,

    transit: transitSection,
    zoom: zoomSection,

    arrival: `
    <section id="arrival">
      <p class="section-label">${esc(data.arrival.label)}</p>
      <h2>${esc(data.arrival.heading)}</h2>
      <div class="card">
${renderInfoBlocks(data.arrival.blocks)}
      </div>
    </section>`,

    registration: `
    <section id="registration">
      <p class="section-label">${esc(data.registration.label)}</p>
      <h2>${esc(data.registration.heading)}</h2>
      <div class="tips-grid">
${regCards}
      </div>
    </section>`,

    contact: `
    <section id="contact">
      <p class="section-label">${esc(data.contact.label)}</p>
      <h2>${esc(data.contact.heading)}</h2>
      <div class="contact-bar">
        <p>
          ${data.contact.body}
        </p>
        <a class="btn" href="mailto:${esc(data.contact.email)}">${esc(data.contact.buttonText)}</a>
      </div>
    </section>`,
  };

  const mainSections = sectionOrder
    .map((id) => {
      if (id.startsWith('custom:')) return renderCustomSection(customById[id] || {});
      return sectionHtml[id] || '';
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${esc(data.title)}</title>
  <link rel="stylesheet" href="../css/site.css" />
</head>
<body>

  <div class="site-bar">
    <div class="site-bar-inner">
      <a class="back-link" href="../index.html">← Back to prep guide</a>
      <span style="color: var(--muted); font-size: 0.82rem;">${esc(data.barLabel)}</span>
    </div>
  </div>

  <header class="hero hero-single">
    <div class="hero-inner">
      <div class="hero-text">
        <p class="eyebrow">${esc(data.hero.eyebrow)}</p>
        <h1>${esc(data.hero.title)}</h1>
        <p class="lead">${esc(data.hero.lead)}</p>
      </div>
      <div class="hero-graphic">
        <div class="hero-photo">${esc(data.hero.photo)}</div>
      </div>
    </div>
  </header>

  <nav class="page-nav" aria-label="Location sections">
    <div class="page-nav-inner">
${navLinks}
    </div>
  </nav>

  <main>
${mainSections}
  </main>

  <footer>
    <p><a href="../index.html">← Back to main prep guide</a></p>
  </footer>

</body>
</html>
`;
}

function buildAll() {
  const indexData = readJson(contentPath('index.json'));
  writeFile(path.join(ROOT, 'index.html'), buildIndex(indexData));
  console.log('Built index.html');

  const locContentDir = contentPath('locations');
  const files = fs.readdirSync(locContentDir).filter((f) => f.endsWith('.json'));
  files.forEach((f) => {
    const data = readJson(path.join(locContentDir, f));
    const out = path.join(ROOT, 'locations', f.replace('.json', '.html'));
    writeFile(out, buildLocation(data));
    console.log('Built', path.relative(ROOT, out));
  });

  return { pages: 1 + files.length };
}

if (require.main === module) {
  buildAll();
  console.log('Done.');
}

module.exports = { buildAll, buildIndex, buildLocation };
