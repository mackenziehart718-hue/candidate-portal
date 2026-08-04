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

function sectionStyleAttr(section) {
  const style = section?.style || {};
  const parts = [];
  if (style.color) parts.push(`color: ${esc(style.color)}`);
  if (style.fontWeight) parts.push(`font-weight: ${esc(style.fontWeight)}`);
  return parts.length ? ` style="${parts.join('; ')}"` : '';
}

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
    <section id="${domId}"${sectionStyleAttr(entry)}>
      <h2>${esc(entry.heading)}</h2>
${intro}${body}
    </section>`;
}

function renderFaqSection(faqs) {
  if (!faqs?.items?.length) return '';
  const items = faqs.items
    .map(
      (f) => `      <details class="faq-item">
        <summary>${esc(f.question)}</summary>
        <p>${f.answer}</p>
      </details>`
    )
    .join('\n');
  return `
    <section id="faq"${sectionStyleAttr(faqs)}>
      <h2>${esc(faqs.heading)}</h2>
      <div class="faq-plain">
${items}
      </div>
    </section>`;
}

function buildIndex(data) {
  const prepItems = data.prepare.steps
    .map(
      (s, i) => `        <div class="prep-step">
          <span class="prep-badge">${i + 1}</span>
          <h3>${esc(s.title)}</h3>
          <div class="rich-body">${s.body}</div>
        </div>`
    )
    .join('\n');

  const locationCards = data.locations.items
    .map(
      (l) => `        <a class="location-photo-card" href="locations/${esc(l.slug)}.html">
          <div class="photo-placeholder photo-placeholder--soft" aria-hidden="true"></div>
          <h3>${esc(l.title)} <span class="loc-arrow" aria-hidden="true">&rarr;</span></h3>
        </a>`
    )
    .join('\n');

  const sectionOrder = getIndexSectionOrder(data);
  const navLinks = buildIndexNav(sectionOrder, data);
  const customById = Object.fromEntries(getIndexCustomSections(data).map((s) => [customSectionId(s), s]));

  const sectionHtml = {
    welcome: `
    <section id="welcome"${sectionStyleAttr(data.welcome)}>
      <div class="about-grid">
        <div>
          <h2>${esc(data.welcome.heading)}</h2>
          <p class="section-intro">
            ${data.welcome.intro}
          </p>
          <a class="btn" href="${esc(data.welcome.buttonUrl)}">${esc(data.welcome.buttonText)}</a>
        </div>
        <div class="photo-placeholder photo-placeholder--soft" aria-hidden="true"></div>
      </div>
    </section>`,

    prepare: `
    <section id="prepare"${sectionStyleAttr(data.prepare)}>
      <h2>${esc(data.prepare.heading)}</h2>
      <div class="prep-grid">
${prepItems}
      </div>
    </section>`,

    locations: `
    <section id="locations"${sectionStyleAttr(data.locations)}>
      <h2>${esc(data.locations.heading)}</h2>
      <div class="locations-photo-grid">
${locationCards}
      </div>
    </section>`,

    faq: renderFaqSection(data.faqs),

    contact: `
    <section id="contact"${sectionStyleAttr(data.contact)}>
      <h2>${esc(data.contact.heading)}</h2>
      <p class="section-intro">
        ${data.contact.body}
      </p>
      <a class="btn" href="mailto:${esc(data.contact.email)}">${esc(data.contact.buttonText)}</a>
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
  <link rel="stylesheet" href="css/site.css" />
</head>
<body class="page-index">

  <nav class="page-nav minimal" id="top" aria-label="Page sections">
    <div class="page-nav-inner">
${navLinks}
    </div>
  </nav>

  <header class="hero hero-centered">
    <div class="hero-inner">
      <h1 class="gradient-title">${esc(data.hero.heading)}</h1>
      <p class="lead">${esc(data.hero.lead)}</p>
      ${
        data.video?.youtubeId && data.video.youtubeId !== 'VIDEO_ID_HERE'
          ? `<div class="hero-image video-embed">
        <iframe
          src="https://www.youtube.com/embed/${esc(data.video.youtubeId)}"
          title="${esc(data.video.iframeTitle || data.video.heading || 'Video')}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          loading="lazy"
        ></iframe>
      </div>`
          : `<div class="hero-image photo-placeholder" aria-hidden="true"></div>`
      }
    </div>
  </header>

  <main>
${mainSections}
  </main>

  <footer>
    <p>© ${data.footer.year} Box · <a href="${esc(data.footer.careersUrl)}">Careers</a></p>
    <p style="margin-top: 0.4rem;">${esc(data.footer.note)}</p>
  </footer>

  <script src="js/nav-scroll.js" defer></script>
  <script src="js/nav-dialkit.js" defer></script>
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
    <section id="transit"${sectionStyleAttr(data.transit)}>
      <h2>${esc(data.transit.heading)}</h2>
      <div class="card">
${renderInfoBlocks(data.transit.blocks)}
      </div>
    </section>`
    : '';

  const zoomSection = data.zoom
    ? `
    <section id="zoom"${sectionStyleAttr(data.zoom)}>
      <h2>${esc(data.zoom.heading)}</h2>
      <div class="card">
${renderInfoBlocks(data.zoom.blocks)}
      </div>
    </section>`
    : '';

  const sectionHtml = {
    address: `
    <section id="address"${sectionStyleAttr(data.address)}>
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
    <section id="arrival"${sectionStyleAttr(data.arrival)}>
      <h2>${esc(data.arrival.heading)}</h2>
      <div class="card">
${renderInfoBlocks(data.arrival.blocks)}
      </div>
    </section>`,

    registration: `
    <section id="registration"${sectionStyleAttr(data.registration)}>
      <h2>${esc(data.registration.heading)}</h2>
      <div class="tips-grid">
${regCards}
      </div>
    </section>`,

    contact: `
    <section id="contact"${sectionStyleAttr(data.contact)}>
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

  <script src="../js/nav-scroll.js" defer></script>
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
