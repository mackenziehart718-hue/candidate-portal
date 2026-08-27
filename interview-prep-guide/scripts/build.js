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

let buildOptions = { editable: false };

function eText(path, value) {
  const inner = esc(value ?? '');
  if (!buildOptions.editable) return inner;
  return `<span class="prep-edit" contenteditable="true" data-edit-path="${path}" data-edit-type="text" spellcheck="true">${inner}</span>`;
}

function eHtml(path, value) {
  const html = value ?? '';
  if (!buildOptions.editable) return html;
  return `<span class="prep-edit prep-edit-html" contenteditable="true" data-edit-path="${path}" data-edit-type="html" spellcheck="true">${html}</span>`;
}

function paragraphsToPlain(paragraphs) {
  return (paragraphs || [])
    .map((p) => {
      if (p.type === 'list') return (p.items || []).join('\n');
      return String(p.html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
    })
    .filter(Boolean)
    .join('\n\n');
}

function eParagraphs(path, paragraphs) {
  if (!buildOptions.editable) return renderParagraphs({ paragraphs });
  const plain = esc(paragraphsToPlain(paragraphs)).replace(/\n/g, '<br>');
  return `<div class="prep-edit prep-edit-paragraphs" contenteditable="true" data-edit-path="${path}" data-edit-type="paragraphs" spellcheck="true">${plain}</div>`;
}

function sectionHeading(path, heading) {
  if (!buildOptions.editable) return esc(heading);
  return eText(path, heading);
}

function sectionStyleAttr(section) {
  const style = section?.style || {};
  const parts = [];
  if (style.color) parts.push(`color: ${esc(style.color)}`);
  if (style.fontWeight) parts.push(`font-weight: ${esc(style.fontWeight)}`);
  return parts.length ? ` style="${parts.join('; ')}"` : '';
}

/**
 * Renders an icon field as inline SVG (recolorable via CSS currentColor),
 * an <img> for raster files, or the raw string as-is (e.g. an emoji).
 */
function renderIcon(icon, assetPrefix = '') {
  if (!icon) return '';
  const ext = path.extname(icon).toLowerCase();
  if (ext === '.svg') {
    const file = path.join(ROOT, 'icons', icon);
    if (fs.existsSync(file)) {
      return fs
        .readFileSync(file, 'utf8')
        .replace(/<\?xml[^?]*\?>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim();
    }
    return `<img src="${assetPrefix}icons/${encodeURIComponent(icon)}" alt="" />`;
  }
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    return `<img src="${assetPrefix}icons/${encodeURIComponent(icon)}" alt="" />`;
  }
  return icon;
}

function mapsEmbedSrc(mapsUrl) {
  if (!mapsUrl) return '';
  try {
    const u = new URL(mapsUrl);
    const q = u.searchParams.get('q');
    if (q) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&hl=en&z=16&output=embed`;
    }
  } catch {
    return '';
  }
  return '';
}

function renderAssetIcon(icon, assetPrefix = '') {
  if (!icon) return '';
  if (icon.includes('/')) {
    return `<img src="${assetPrefix}${esc(icon)}" alt="" />`;
  }
  return renderIcon(icon, assetPrefix);
}

function renderTipIcon(icon) {
  return renderAssetIcon(icon, '../');
}

function renderTipCard(card, index, sectionKey) {
  const note = card.note
    ? `\n          <p class="tip-card-note">${buildOptions.editable && sectionKey ? eHtml(`${sectionKey}.cards.${index}.note`, card.note) : card.note}</p>`
    : '';
  const title =
    buildOptions.editable && sectionKey
      ? eText(`${sectionKey}.cards.${index}.title`, card.title)
      : esc(card.title);
  const body =
    buildOptions.editable && sectionKey
      ? eHtml(`${sectionKey}.cards.${index}.body`, card.body)
      : card.body;
  const iconHtml = card.icon
    ? `          <span class="tip-card-icon" aria-hidden="true">${renderTipIcon(card.icon)}</span>\n`
    : '';
  return `        <div class="card tip-card">
${iconHtml}          <h3>${title}</h3>
          <div class="tip-body">${body}</div>${note}
        </div>`;
}

function renderTipCardFromBlock(block) {
  const iconHtml = block.icon
    ? `          <span class="tip-card-icon" aria-hidden="true">${renderTipIcon(block.icon)}</span>\n`
    : '';
  return `        <div class="card tip-card">
${iconHtml}          <h3>${esc(block.title || '')}</h3>
          <div class="tip-body">${renderParagraphs(block)}</div>
        </div>`;
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
        if (/<p[\s>]|<ul|<ol|<li|<div|<br/i.test(html)) return html;
        return `<p${margin}>${html}</p>`;
      }
      return `<p>${esc(p.text)}</p>`;
    })
    .join('\n            ');
}

const FOOTER_SOCIAL_SVGS = {
  youtube:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>',
  blog: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
  twitter:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  facebook:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
};

function renderFooter(assetPrefix = '') {
  const footer = readJson(contentPath('index.json')).footer || {};
  const logoUrl = footer.logoUrl || 'https://www.box.com/';
  const socials = footer.social || [];
  const items = socials
    .map((s) => {
      const icon = FOOTER_SOCIAL_SVGS[s.icon] || '';
      return `        <li>
          <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.name)}">
            ${icon}
          </a>
        </li>`;
    })
    .join('\n');

  return `  <footer class="site-footer">
    <div class="site-footer-inner">
      <a class="site-footer-logo" href="${esc(logoUrl)}" target="_blank" rel="noopener noreferrer">
        <img src="${assetPrefix}images/footer/box-logo-white.svg" alt="Box" height="40" />
      </a>
      <ul class="site-footer-socials" aria-label="Follow Box">
${items}
      </ul>
    </div>
  </footer>`;
}

function renderInfoBlocks(blocks, showIcons = true, sectionKey = '') {
  return (blocks || [])
    .map((b, i) => {
      const title =
        buildOptions.editable && sectionKey
          ? eText(`${sectionKey}.blocks.${i}.title`, b.title || '')
          : b.title || '';
      const iconContent =
        buildOptions.editable && sectionKey
          ? eText(`${sectionKey}.blocks.${i}.icon`, b.icon || '📍')
          : b.icon || '📍';
      const bodyContent =
        buildOptions.editable && sectionKey
          ? eParagraphs(`${sectionKey}.blocks.${i}.paragraphs`, b.paragraphs)
          : renderParagraphs(b);
      return `        <div class="info-block${showIcons ? '' : ' no-icon'}">
          ${showIcons ? `<span class="info-icon">${iconContent}</span>` : ''}
          <div>
            <h3>${title}</h3>
            ${bodyContent}
          </div>
        </div>`;
    })
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
  const intro = entry.intro
    ? `      <p class="section-intro">${entry.intro}</p>\n`
    : '';
  const blocks = entry.blocks || [];
  let body;
  if (blocks.length) {
    const cards = blocks.map((b) => renderTipCardFromBlock(b)).join('\n');
    body = `      <div class="tips-grid">
${cards}
      </div>`;
  } else {
    body = entry.bodyHtml ? `      <p>${entry.bodyHtml}</p>` : '';
  }
  return `
    <section id="${domId}"${sectionStyleAttr(entry)}>
      <h2>${esc(entry.heading)}</h2>
${intro}${body}
    </section>`;
}

function renderStepsList(items, { sectionKey, itemsKey = 'items', photoPlaceholder = false } = {}) {
  return (items || [])
    .map((item, i) => {
      const hasPhoto = !!item.photoUrl;
      const photo = hasPhoto
        ? `<img src="../${esc(item.photoUrl)}" alt="${esc(item.photoAlt || '')}" />`
        : '';
      const title =
        buildOptions.editable && sectionKey
          ? eText(`${sectionKey}.${itemsKey}.${i}.title`, item.title || '')
          : esc(item.title || '');
      const body =
        buildOptions.editable && sectionKey
          ? eParagraphs(`${sectionKey}.${itemsKey}.${i}.paragraphs`, item.paragraphs)
          : renderParagraphs(item);
      let photoCol = '';
      if (hasPhoto) {
        photoCol = `<div class="step-photo">${photo}</div>`;
      } else if (photoPlaceholder) {
        photoCol =
          '<div class="step-photo photo-placeholder photo-placeholder--soft"></div>';
      }
      const stepClass = photoCol ? 'step' : 'step step--text-only';
      return `        <div class="${stepClass}">
          <div>
            <div class="step-title">
              <span class="step-num"><span class="badge-num">${i + 1}</span></span>
              <h3>${title}</h3>
            </div>
            <div class="step-body">
              ${body}
            </div>
          </div>
          ${photoCol}
        </div>`;
    })
    .join('\n');
}

function renderGettingHere(id, section) {
  if (!section) return '';
  const intro = section.intro
    ? buildOptions.editable
      ? `      <p class="section-intro">${eText('gettingHere.intro', section.intro)}</p>\n`
      : `      <p class="section-intro">${section.intro}</p>\n`
    : '';
  const steps = renderStepsList(section.items, {
    sectionKey: 'gettingHere',
    itemsKey: 'items',
    photoPlaceholder: true,
  });
  return `
    <section id="${id}"${sectionStyleAttr(section)}>
      <h2>${sectionHeading('gettingHere.heading', section.heading)}</h2>
${intro}      <div class="steps">
${steps}
      </div>
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
          <div class="prep-step-header">
            <span class="prep-badge"><span class="badge-num">${i + 1}</span></span>
            <h3>${esc(s.title)}</h3>
          </div>
          <div class="rich-body">${s.body}</div>
        </div>`
    )
    .join('\n');

  const locationCards = data.locations.items
    .map((l) => {
      const hasImage = !!l.imageUrl;
      const photoInner = hasImage
        ? `<img src="${esc(l.imageUrl)}" alt="${esc(l.imageAlt || l.title)}" />`
        : '';
      const photoBlock = hasImage
        ? `          <div class="location-photo-card">
            ${photoInner}
          </div>`
        : `          <div class="location-photo-card">
            <div class="photo-placeholder photo-placeholder--soft" aria-hidden="true"></div>
          </div>`;
      return `        <a class="location-item" href="locations/${esc(l.slug)}.html">
${photoBlock}
          <h3>${esc(l.title)}</h3>
        </a>`;
    })
    .join('\n');

  const linkCards = (data.links?.items || [])
    .map(
      (l) => `        <a class="card resource-card tip-card" href="${esc(l.url)}" target="_blank" rel="noopener">
          <span class="tip-card-icon" aria-hidden="true">${renderAssetIcon(l.icon)}</span>
          <h3>${esc(l.title)}</h3>
          <div class="tip-body"><p>${esc(l.description)}</p></div>
        </a>`
    )
    .join('\n');

  const sectionOrder = getIndexSectionOrder(data);
  const navLinks = buildIndexNav(sectionOrder, data);
  const customById = Object.fromEntries(getIndexCustomSections(data).map((s) => [customSectionId(s), s]));

  const welcomePhoto = data.welcome?.imageUrl
    ? `        <div class="about-photo">
          <img src="${esc(data.welcome.imageUrl)}" alt="${esc(data.welcome.imageAlt || '')}" />
        </div>`
    : `        <div class="photo-placeholder photo-placeholder--soft" aria-hidden="true"></div>`;

  const sectionHtml = {
    welcome: `
    <section id="welcome"${sectionStyleAttr(data.welcome)}>
      <div class="about-grid">
        <div>
          <h2>${esc(data.welcome.heading)}</h2>
          <p class="section-intro">
            ${data.welcome.intro}
          </p>
          <a class="btn" href="${esc(data.welcome.buttonUrl)}" target="_blank" rel="noopener noreferrer">${esc(data.welcome.buttonText)}</a>
        </div>
${welcomePhoto}
      </div>
    </section>`,

    prepare: `
    <section id="prepare"${sectionStyleAttr(data.prepare)}>
      <h2>${esc(data.prepare.heading)}</h2>
      <div class="prep-grid">
${prepItems}
      </div>
    </section>`,

    links: `
    <section id="links"${sectionStyleAttr(data.links)}>
      <h2>${esc(data.links.heading)}</h2>
      <p class="section-intro">${esc(data.links.intro)}</p>
      <div class="tips-grid links-grid">
${linkCards}
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
      <p class="lead">${esc(data.hero.lead).replace(/\n/g, '<br />')}</p>
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

${renderFooter('')}

  <script src="js/nav-scroll.js" defer></script>
</body>
</html>
`;
}

function buildLocation(data, options = {}) {
  buildOptions = { editable: !!options.editable };
  const sectionOrder = getLocationSectionOrder(data);
  const navLinks = buildLocationNav(sectionOrder, data);
  const customById = Object.fromEntries(getLocationCustomSections(data).map((s) => [customSectionId(s), s]));

  const addressNote = data.address.noteHtml
    ? `        <p class="address-note">
          ${buildOptions.editable ? eHtml('address.noteHtml', data.address.noteHtml) : data.address.noteHtml}
        </p>`
    : '';

  const mapsLink = data.address.mapsUrl
    ? `            <p style="margin-top: 0.75rem;">
              <a href="${esc(data.address.mapsUrl)}" target="_blank" rel="noopener">Open in Google Maps →</a>
            </p>`
    : '';

  const mapsEmbedUrl = data.address.mapsEmbedUrl || mapsEmbedSrc(data.address.mapsUrl);
  const addressMap = mapsEmbedUrl
    ? `        <div class="address-map">
          <iframe
            title="Map to ${esc(data.hero?.title || data.address.heading || 'interview location')}"
            src="${esc(mapsEmbedUrl)}"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            allowfullscreen
          ></iframe>
        </div>`
    : '';

  const addressLayoutClass = mapsEmbedUrl ? 'address-layout' : '';

  const regCards = (data.registration.cards || [])
    .map((c, i) => renderTipCard(c, i, 'registration'))
    .join('\n');

  const transitSection = data.transit
    ? `
    <section id="transit"${sectionStyleAttr(data.transit)}>
      <h2>${sectionHeading('transit.heading', data.transit.heading)}</h2>
      <div class="steps">
${renderStepsList(data.transit.blocks, { sectionKey: 'transit', itemsKey: 'blocks' })}
      </div>
    </section>`
    : '';

  const zoomSection = data.zoom
    ? `
    <section id="zoom"${sectionStyleAttr(data.zoom)}>
      <h2>${sectionHeading('zoom.heading', data.zoom.heading)}</h2>
${renderInfoBlocks(data.zoom.blocks, false, 'zoom')}
    </section>`
    : '';

  const gettingHereSection = renderGettingHere('gettingHere', data.gettingHere);

  const arrivalSection = data.arrival
    ? `
    <section id="arrival"${sectionStyleAttr(data.arrival)}>
      <h2>${sectionHeading('arrival.heading', data.arrival.heading)}</h2>
${renderInfoBlocks(data.arrival.blocks, false, 'arrival')}
    </section>`
    : '';

  const sectionHtml = {
    address: `
    <section id="address"${sectionStyleAttr(data.address)}>
      <h2>${sectionHeading('address.heading', data.address.heading)}</h2>
      <div class="${addressLayoutClass}">
        <div class="address-card">
          <p class="address-line">
            ${buildOptions.editable ? eHtml('address.addressHtml', data.address.addressHtml) : data.address.addressHtml}
          </p>
${addressNote}${mapsLink}
        </div>
${addressMap}
      </div>
    </section>`,

    transit: transitSection,
    zoom: zoomSection,
    gettingHere: gettingHereSection,
    arrival: arrivalSection,

    registration: `
    <section id="registration"${sectionStyleAttr(data.registration)}>
      <h2>${sectionHeading('registration.heading', data.registration.heading)}</h2>
      <div class="tips-grid">
${regCards}
      </div>
    </section>`,

    contact: `
    <section id="contact"${sectionStyleAttr(data.contact)}>
      <h2>${sectionHeading('contact.heading', data.contact.heading)}</h2>
      <p class="section-intro">
        ${buildOptions.editable ? eText('contact.body', data.contact.body) : data.contact.body}
      </p>
      <a class="btn" href="mailto:${esc(data.contact.email)}">${buildOptions.editable ? eText('contact.buttonText', data.contact.buttonText) : esc(data.contact.buttonText)}</a>
    </section>`,
  };

  const mainSections = sectionOrder
    .map((id) => {
      if (id.startsWith('custom:')) return renderCustomSection(customById[id] || {});
      return sectionHtml[id] || '';
    })
    .join('\n');

  const heroHasPhoto = !!data.hero.photoUrl;
  const heroXlClass = ' hero-xl';
  const heroPhoto = heroHasPhoto
    ? `<img src="../${esc(data.hero.photoUrl)}" alt="${esc(data.hero.photoAlt || '')}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${esc(data.title)}</title>
  <link rel="stylesheet" href="../css/site.css" />
</head>
<body class="page-location page-${esc(data.slug)}">

  <nav class="page-nav page-nav--location" aria-label="Location sections">
    <div class="page-nav-inner">
      <a class="back-link page-nav-back" href="../index.html">← Back to Main Page</a>
      <div class="page-nav-links">
${navLinks}
      </div>
    </div>
  </nav>

  <header class="hero hero-single${heroXlClass}">
    <div class="hero-inner">
      <div class="hero-text">
        <h1>${buildOptions.editable ? eText('hero.title', data.hero.title) : esc(data.hero.title)}</h1>
        <p class="lead">${buildOptions.editable ? eText('hero.lead', data.hero.lead) : esc(data.hero.lead)}</p>
      </div>
      <div class="hero-graphic">
        <div class="hero-photo${heroHasPhoto ? '' : ' photo-placeholder photo-placeholder--soft'}"${heroHasPhoto ? '' : ' aria-hidden="true"'}>${heroPhoto}</div>
      </div>
    </div>
  </header>

  <main>
${mainSections}
  </main>

${renderFooter('../')}

  <script src="../js/nav-scroll.js" defer></script>
</body>
</html>
`;
}

function buildAll(options = {}) {
  const excludeSlugs = new Set(
    Array.isArray(options.excludeSlugs) ? options.excludeSlugs.filter(Boolean) : []
  );
  const skipIndex = options.skipIndex === true;

  let pages = 0;

  if (!skipIndex) {
    const indexData = readJson(contentPath('index.json'));
    writeFile(path.join(ROOT, 'index.html'), buildIndex(indexData));
    console.log('Built index.html');
    pages += 1;
  }

  const locContentDir = contentPath('locations');
  const files = fs.readdirSync(locContentDir).filter((f) => f.endsWith('.json'));
  files.forEach((f) => {
    const slug = f.replace('.json', '');
    if (excludeSlugs.has(slug)) {
      console.log('Skipped', path.join('locations', `${slug}.html`));
      return;
    }
    const data = readJson(path.join(locContentDir, f));
    const out = path.join(ROOT, 'locations', `${slug}.html`);
    writeFile(out, buildLocation(data));
    console.log('Built', path.relative(ROOT, out));
    pages += 1;
  });

  return { pages, excluded: [...excludeSlugs] };
}

if (require.main === module) {
  const excludeArg = process.argv.find((arg) => arg.startsWith('--exclude='));
  const excludeSlugs = excludeArg
    ? excludeArg
        .slice('--exclude='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  buildAll({ excludeSlugs });
  console.log('Done.');
}

module.exports = { buildAll, buildIndex, buildLocation };
