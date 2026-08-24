const LOCKED_SLUGS = new Set([]);

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function setByPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (cur[keys[i]] == null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function stripHtml(html) {
  const el = document.createElement('div');
  el.innerHTML = html || '';
  return el.textContent || '';
}

function paragraphsToText(paragraphs) {
  return (paragraphs || [])
    .map((p) => {
      if (p.type === 'list') return (p.items || []).join('\n');
      return stripHtml(p.html || '');
    })
    .filter(Boolean)
    .join('\n\n');
}

function textToParagraphs(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  if (trimmed.includes('\n\n')) {
    return trimmed
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => ({ type: 'html', html: block.replace(/\n/g, '<br>') }));
  }
  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) return [{ type: 'list', items: lines }];
  if (lines.length === 1) return [{ type: 'html', html: lines[0] }];
  return [];
}

function field(label, path, value = '', opts = {}) {
  const type = opts.type || 'text';
  const hint = opts.hint ? `<p class="field-hint">${opts.hint}</p>` : '';
  const rows = opts.rows ? ` rows="${opts.rows}"` : '';
  const input =
    type === 'textarea'
      ? `<textarea class="input" data-path="${path}"${rows}>${esc(value)}</textarea>`
      : `<input class="input" type="${type}" data-path="${path}" value="${esc(value)}" />`;
  return `<div class="field">
    <label>${label}</label>
    ${input}
    ${hint}
  </div>`;
}

function section(title, body, open = true) {
  return `<details class="form-section" ${open ? 'open' : ''}>
    <summary>${title}</summary>
    <div class="form-section-body">${body}</div>
  </details>`;
}

function renderInfoBlocks(sectionKey, data, label) {
  const section = data[sectionKey];
  if (!section) return '';

  const blocks = section.blocks || [];
  const blocksHtml = blocks
    .map((block, index) => {
      const content = paragraphsToText(block.paragraphs);
      return `<div class="subcard" data-block-section="${sectionKey}" data-block-index="${index}">
        <div class="subcard-head">
          <strong>Block ${index + 1}</strong>
          <button type="button" class="btn btn-sm btn-danger" data-action="remove-block">Remove</button>
        </div>
        ${field('Icon (emoji)', `${sectionKey}.blocks.${index}.icon`, block.icon || '', { hint: 'Example: 🚗 or 🚪' })}
        ${field('Title', `${sectionKey}.blocks.${index}.title`, block.title || '')}
        ${field('Content', `${sectionKey}.blocks.${index}.content`, content, {
          type: 'textarea',
          rows: 5,
          hint: 'One bullet per line, or a short paragraph.',
        })}
      </div>`;
    })
    .join('');

  return section(
    label,
    `${field('Section heading', `${sectionKey}.heading`, section.heading || '')}
    <div class="block-list">${blocksHtml}</div>
    <button type="button" class="btn btn-sm" data-action="add-block" data-block-section="${sectionKey}">+ Add block</button>`
  );
}

function renderRegistrationCards(data) {
  const section = data.registration;
  if (!section) return '';

  const cards = section.cards || [];
  const cardsHtml = cards
    .map((card, index) => {
      const noteField = card.note
        ? field('Extra note (optional)', `registration.cards.${index}.note`, card.note, {
            type: 'textarea',
            rows: 3,
          })
        : field('Extra note (optional)', `registration.cards.${index}.note`, '', {
            type: 'textarea',
            rows: 3,
          });
      return `<div class="subcard" data-card-index="${index}">
        <div class="subcard-head">
          <strong>Card ${index + 1}</strong>
        </div>
        ${field('Title', `registration.cards.${index}.title`, card.title || '')}
        ${richField(`Card ${index + 1} text`, `registration.cards.${index}.body`, card.body || '')}
        ${noteField}
      </div>`;
    })
    .join('');

  return section(
    'Registration',
    `${field('Section heading', 'registration.heading', section.heading || '')}
    ${cardsHtml}`
  );
}

function renderGettingHereForm(data) {
  const section = data.gettingHere;
  if (!section) return '';

  const itemsHtml = (section.items || [])
    .map((item, index) => {
      const content = paragraphsToText(item.paragraphs);
      return `<div class="subcard" data-getting-here-index="${index}">
        <div class="subcard-head"><strong>Step ${index + 1}</strong></div>
        ${field('Step title', `gettingHere.items.${index}.title`, item.title || '')}
        ${field('Step content', `gettingHere.items.${index}.content`, content, {
          type: 'textarea',
          rows: 6,
          hint: 'Separate paragraphs with a blank line. One line per bullet for lists.',
        })}
      </div>`;
    })
    .join('');

  return section(
    'Getting here (step-by-step)',
    `${field('Section heading', 'gettingHere.heading', section.heading || '')}
    ${field('Intro', 'gettingHere.intro', section.intro || '', { type: 'textarea', rows: 3 })}
    ${itemsHtml}`
  );
}

function renderLocationForm(data) {
  const middleSection = data.zoom
    ? renderInfoBlocks('zoom', data, 'Zoom setup')
    : data.gettingHere
      ? renderGettingHereForm(data)
      : renderInfoBlocks('transit', data, 'Parking & transit');

  const arrivalSection = data.arrival
    ? renderInfoBlocks('arrival', data, 'When you arrive')
    : '';

  return `
    ${section(
      'Page header',
      `${field('Browser tab title', 'title', data.title || '')}
      ${field('Top bar label', 'barLabel', data.barLabel || '')}`
    )}
    ${section(
      'Hero',
      `${field('City name', 'hero.title', data.hero?.title || '')}
      ${field('Subtitle', 'hero.lead', data.hero?.lead || '')}
      ${field('Photo placeholder', 'hero.photo', data.hero?.photo || '', {
        hint: 'Emoji or short label until a real photo is added.',
      })}`
    )}
    ${section(
      'Address',
      `${field('Section heading', 'address.heading', data.address?.heading || 'Where to go')}
      ${richField('Street address', 'address.addressHtml', data.address?.addressHtml || '', 'Use line breaks for a second line.')}
      ${field('Google Maps link', 'address.mapsUrl', data.address?.mapsUrl || '', {
        hint: 'Full https:// link. Leave blank if not needed.',
      })}
      ${richField('Extra note (optional)', 'address.noteHtml', data.address?.noteHtml || '')}`
    )}
    ${middleSection}
    ${arrivalSection}
    ${renderRegistrationCards(data)}
    ${section(
      'Contact',
      `${field('Section heading', 'contact.heading', data.contact?.heading || '')}
      ${field('Message', 'contact.body', data.contact?.body || '', { type: 'textarea', rows: 3 })}
      ${field('Email address', 'contact.email', data.contact?.email || '')}
      ${field('Button label', 'contact.buttonText', data.contact?.buttonText || '')}`
    )}
  `;
}

function readFormIntoContent(container, content) {
  container.querySelectorAll('[data-path]').forEach((el) => {
    const path = el.dataset.path;
    if (path.endsWith('.content')) return;
    setByPath(content, path, el.value);
  });

  container.querySelectorAll('.subcard[data-block-section][data-block-index]').forEach((card) => {
    const sectionKey = card.dataset.blockSection;
    const index = Number(card.dataset.blockIndex);
    const contentPath = `${sectionKey}.blocks.${index}.content`;
    const textarea = card.querySelector(`[data-path="${contentPath}"]`);
    if (!textarea) return;
    const paragraphs = textToParagraphs(textarea.value);
    if (!content[sectionKey]) content[sectionKey] = { blocks: [] };
    if (!content[sectionKey].blocks[index]) content[sectionKey].blocks[index] = {};
    content[sectionKey].blocks[index].paragraphs = paragraphs;
  });

  container.querySelectorAll('.subcard[data-getting-here-index]').forEach((card) => {
    const index = Number(card.dataset.gettingHereIndex);
    const contentPath = `gettingHere.items.${index}.content`;
    const textarea = card.querySelector(`[data-path="${contentPath}"]`);
    if (!textarea) return;
    const paragraphs = textToParagraphs(textarea.value);
    if (!content.gettingHere) content.gettingHere = { items: [] };
    if (!content.gettingHere.items[index]) content.gettingHere.items[index] = {};
    content.gettingHere.items[index].paragraphs = paragraphs;
  });

  readRichEditors(container, content, setByPath);
}

function bindBlockActions(container, content, onChange) {
  container.querySelectorAll('[data-action="add-block"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sectionKey = btn.dataset.blockSection;
      if (!content[sectionKey]) content[sectionKey] = { heading: '', blocks: [] };
      if (!content[sectionKey].blocks) content[sectionKey].blocks = [];
      content[sectionKey].blocks.push({
        icon: '📍',
        title: 'New block',
        paragraphs: [{ type: 'html', html: 'Add your text here.' }],
      });
      onChange();
    });
  });

  container.querySelectorAll('[data-action="remove-block"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('[data-block-section][data-block-index]');
      const sectionKey = card.dataset.blockSection;
      const index = Number(card.dataset.blockIndex);
      content[sectionKey].blocks.splice(index, 1);
      onChange();
    });
  });
}

function applyVisualEdit(content, path, editType, value) {
  if (editType === 'paragraphs') {
    setByPath(content, path, textToParagraphs(value));
  } else if (editType === 'html') {
    setByPath(content, path, normalizeRichHtml(value));
  } else {
    setByPath(content, path, value);
  }
}

window.LocationForm = {
  LOCKED_SLUGS,
  renderLocationForm,
  readFormIntoContent,
  bindBlockActions,
  applyVisualEdit,
};
