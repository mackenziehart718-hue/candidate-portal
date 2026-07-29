let currentPage = 'index';
let content = null;
let previewTimer = null;
let dragSectionId = null;
let previewMode = sessionStorage.getItem('prep-editor-preview-mode') || 'desktop';

const INDEX_SECTIONS = {
  welcome: 'Welcome',
  prepare: 'How to prepare',
  faq: 'FAQs',
  locations: 'Location cards',
  contact: 'Contact',
};

const DEFAULT_INDEX_ORDER = Object.keys(INDEX_SECTIONS);

const LOCATION_SECTIONS = {
  address: 'Address',
  transit: 'Parking & transit',
  zoom: 'Zoom setup',
  arrival: 'Arrival & check-in',
  registration: 'Registration cards',
  contact: 'Contact',
};

function getIndexLabels(data) {
  const labels = { ...INDEX_SECTIONS };
  (data.customSections || []).forEach((s) => {
    labels[`custom:${s.id}`] = s.navLabel || s.heading || 'Custom section';
  });
  return labels;
}

function getLocationLabels(data) {
  const labels = { ...LOCATION_SECTIONS };
  (data.customSections || []).forEach((s) => {
    labels[`custom:${s.id}`] = s.navLabel || s.heading || 'Custom section';
  });
  return labels;
}

function ensureIndexSectionOrder(data) {
  const available = new Set(DEFAULT_INDEX_ORDER);
  (data.customSections || []).forEach((s) => available.add(`custom:${s.id}`));
  const order = Array.isArray(data.sectionOrder) ? [...data.sectionOrder] : [...DEFAULT_INDEX_ORDER];
  const seen = new Set();
  data.sectionOrder = [];
  order.forEach((id) => {
    if (available.has(id) && !seen.has(id)) {
      data.sectionOrder.push(id);
      seen.add(id);
    }
  });
  [...DEFAULT_INDEX_ORDER, ...(data.customSections || []).map((s) => `custom:${s.id}`)].forEach((id) => {
    if (available.has(id) && !seen.has(id)) data.sectionOrder.push(id);
  });
  if (!data.customSections) data.customSections = [];
}

function ensureLocationSectionOrder(data) {
  const available = ['address', 'arrival', 'registration', 'contact'];
  if (data.zoom) available.splice(1, 0, 'zoom');
  else if (data.transit) available.splice(1, 0, 'transit');
  (data.customSections || []).forEach((s) => available.push(`custom:${s.id}`));
  const availableSet = new Set(available);
  const defaultOrder = data.zoom
    ? ['address', 'zoom', 'arrival', 'registration', 'contact']
    : ['address', 'transit', 'arrival', 'registration', 'contact'];
  (data.customSections || []).forEach((s) => defaultOrder.push(`custom:${s.id}`));
  const order = Array.isArray(data.sectionOrder) ? [...data.sectionOrder] : [...defaultOrder];
  const seen = new Set();
  data.sectionOrder = [];
  order.forEach((id) => {
    if (availableSet.has(id) && !seen.has(id)) {
      data.sectionOrder.push(id);
      seen.add(id);
    }
  });
  defaultOrder.forEach((id) => {
    if (!seen.has(id)) data.sectionOrder.push(id);
  });
  if (!data.customSections) data.customSections = [];
}

const $ = (sel) => document.querySelector(sel);
const formView = $('#form-view');
const jsonEditor = $('#json-editor');
const preview = $('#preview');
const statusEl = $('#status');

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) return res.json();
  return res.text();
}

function blockBodyHtml(block) {
  return (block.paragraphs || []).map((p) => p.html || p.text || '').join('');
}

function infoBlocksEditor(sectionKey, section, legend) {
  if (!section) return '';
  let html = `<fieldset data-section="${sectionKey}"><legend>${legend}</legend>
    ${styleFields(sectionKey, section.style)}
    ${field('Heading', `${sectionKey}.heading`, section.heading)}`;
  (section.blocks || []).forEach((b, bi) => {
    html += `<div class="item-card">
      <div class="item-card-header"><span>Content block ${bi + 1}</span>
        <div class="item-actions">
          <button type="button" data-action="remove-block" data-section="${sectionKey}" data-i="${bi}">Remove</button>
        </div>
      </div>
      ${field('Icon', `${sectionKey}.blocks.${bi}.icon`, b.icon)}
      ${field('Title', `${sectionKey}.blocks.${bi}.title`, b.title)}
      ${richField('Content', `${sectionKey}.blocks.${bi}.body`, blockBodyHtml(b), 'Select text and click B to bold. Use bullet list for multiple points.')}
    </div>`;
  });
  html += `<button type="button" class="add-btn" data-action="add-block" data-section="${sectionKey}">+ Add content block</button></fieldset>`;
  return html;
}

function customSectionsAddButton() {
  return '<fieldset><legend>Add more sections</legend><p class="field-hint">Create a new draggable section with content blocks. It appears in the page order list above once added.</p><button type="button" class="add-btn" data-action="add-custom-section">+ Add content section</button></fieldset>';
}

function renderSectionSorter(sectionOrder, labels) {
  const items = sectionOrder
    .map(
      (id) => `<li class="sortable-item" draggable="true" data-section="${id}">
        <span class="sortable-handle" aria-hidden="true">⠿</span>
        <span class="sortable-label">${escapeAttr(labels[id] || id)}</span>
      </li>`
    )
    .join('');
  return `<div class="section-sorter">
    <p class="section-sorter-title">Page sections — drag to reorder</p>
    <ul class="sortable-list" id="section-order-list">${items}</ul>
  </div>`;
}

function bindSectionDragDrop() {
  const list = $('#section-order-list');
  if (!list) return;

  list.querySelectorAll('.sortable-item').forEach((item) => {
    item.addEventListener('dragstart', (e) => {
      dragSectionId = item.dataset.section;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      list.querySelectorAll('.sortable-item').forEach((el) => el.classList.remove('drag-over'));
      dragSectionId = null;
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (item.dataset.section !== dragSectionId) item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const targetId = item.dataset.section;
      if (!dragSectionId || dragSectionId === targetId) return;

      if (currentPage === 'index') ensureIndexSectionOrder(content);
      else ensureLocationSectionOrder(content);

      const order = [...content.sectionOrder];
      const from = order.indexOf(dragSectionId);
      const to = order.indexOf(targetId);
      if (from < 0 || to < 0) return;

      order.splice(from, 1);
      order.splice(to, 0, dragSectionId);
      content.sectionOrder = order;
      jsonEditor.value = JSON.stringify(content, null, 2);
      renderForm();
      refreshPreview();
      setStatus('Unsaved changes');
    });
  });
}

function field(label, key, value = '', opts = {}) {
  const { textarea = false, hint = '', path = key } = opts;
  const id = `f-${path.replace(/\./g, '-')}`;
  const input = textarea
    ? `<textarea id="${id}" data-path="${path}">${escapeAttr(value)}</textarea>`
    : `<input id="${id}" data-path="${path}" value="${escapeAttr(value)}" />`;
  return `<div class="field">
    <label for="${id}">${label}</label>
    ${input}
    ${hint ? `<p class="field-hint">${hint}</p>` : ''}
  </div>`;
}

const FONT_WEIGHTS = [
  ['', 'Default'],
  ['300', 'Light (300)'],
  ['400', 'Normal (400)'],
  ['500', 'Medium (500)'],
  ['600', 'Semibold (600)'],
  ['700', 'Bold (700)'],
];

function styleFields(sectionKey, style = {}) {
  const color = style?.color || '#212121';
  const weight = style?.fontWeight || '';
  const colorId = `f-${sectionKey}-style-color`.replace(/\./g, '-');
  const weightId = `f-${sectionKey}-style-weight`.replace(/\./g, '-');
  const options = FONT_WEIGHTS.map(
    ([value, label]) => `<option value="${value}"${weight === value ? ' selected' : ''}>${label}</option>`
  ).join('');
  return `<div class="field-row">
    <div class="field">
      <label for="${colorId}">Text color</label>
      <input type="color" id="${colorId}" data-path="${sectionKey}.style.color" value="${escapeAttr(color)}" />
    </div>
    <div class="field">
      <label for="${weightId}">Font weight</label>
      <select id="${weightId}" data-path="${sectionKey}.style.fontWeight">${options}</select>
    </div>
  </div>`;
}

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setByPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function syncContentFromForm() {
  const sectionOrder = content?.sectionOrder ? [...content.sectionOrder] : null;
  formView.querySelectorAll('[data-path]').forEach((el) => {
    setByPath(content, el.dataset.path, el.value);
  });
  readRichEditors(formView, content, setByPath);
  syncBlockBodiesFromRich();
  if (sectionOrder) content.sectionOrder = sectionOrder;
  if (currentPage === 'index') ensureIndexSectionOrder(content);
  else ensureLocationSectionOrder(content);
  jsonEditor.value = JSON.stringify(content, null, 2);
}

function syncBlockBodiesFromRich() {
  const apply = (sectionKey) => {
    const section = content[sectionKey];
    if (!section?.blocks) return;
    section.blocks.forEach((block, bi) => {
      const path = `${sectionKey}.blocks.${bi}.body`;
      const val = getByPath(content, path);
      if (val != null) {
        block.paragraphs = [{ type: 'html', html: val }];
        delete block.body;
      }
    });
  };
  ['transit', 'zoom', 'arrival'].forEach(apply);
  (content.customSections || []).forEach((s, si) => {
    (s.blocks || []).forEach((block, bi) => {
      const path = `customSections.${si}.blocks.${bi}.body`;
      const val = getByPath(content, path);
      if (val != null) block.paragraphs = [{ type: 'html', html: val }];
    });
  });
  (content.registration?.cards || []).forEach((card, i) => {
    const notePath = `registration.cards.${i}.note`;
    const note = getByPath(content, notePath);
    if (note != null) card.note = note;
  });
}

function readFormIntoContent() {
  syncContentFromForm();
}

function setPreviewMode(mode) {
  previewMode = mode === 'mobile' ? 'mobile' : 'desktop';
  sessionStorage.setItem('prep-editor-preview-mode', previewMode);
  const panel = $('#preview-panel');
  panel?.classList.toggle('mobile', previewMode === 'mobile');
  document.querySelectorAll('.preview-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.previewMode === previewMode);
  });
}

function initPreviewModeToggle() {
  setPreviewMode(previewMode);
  document.querySelectorAll('.preview-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setPreviewMode(btn.dataset.previewMode);
    });
  });
}

function setPreviewHtml(html) {
  preview.removeAttribute('src');
  preview.srcdoc = html;
}

function setPreviewUrl(url) {
  preview.removeAttribute('srcdoc');
  preview.src = url;
}

function bindFormInputs() {
  formView.querySelectorAll('[data-path]').forEach((el) => {
    el.addEventListener('input', () => {
      setByPath(content, el.dataset.path, el.value);
      jsonEditor.value = JSON.stringify(content, null, 2);
      schedulePreview();
      setStatus('Unsaved changes');
    });
  });
}

function listEditor(label, items, renderItem, extraHtml = '') {
  let html = `<fieldset><legend>${label}</legend>${extraHtml}<div class="list-editor" data-list="${label}">`;
  items.forEach((item, i) => {
    html += `<div class="item-card" data-index="${i}">`;
    html += `<div class="item-card-header"><span>Item ${i + 1}</span><div class="item-actions">`;
    if (i > 0) html += `<button type="button" data-action="up" data-i="${i}">↑</button>`;
    if (i < items.length - 1) html += `<button type="button" data-action="down" data-i="${i}">↓</button>`;
    html += `<button type="button" class="danger" data-action="remove" data-i="${i}">Remove</button>`;
    html += `</div></div>`;
    html += renderItem(item, i);
    html += `</div>`;
  });
  html += `<button type="button" class="add-btn" data-action="add">+ Add item</button></div></fieldset>`;
  return html;
}

function renderIndexForm(data) {
  ensureIndexSectionOrder(data);

  const sectionForms = {
    welcome: () => `<fieldset data-section="welcome"><legend>Welcome</legend>
      ${styleFields('welcome', data.welcome.style)}
      ${field('Heading', 'welcome.heading', data.welcome.heading)}
      ${richField('Intro', 'welcome.intro', data.welcome.intro)}
      ${field('Button text', 'welcome.buttonText', data.welcome.buttonText)}
      ${field('Button URL', 'welcome.buttonUrl', data.welcome.buttonUrl)}
    </fieldset>`,

    prepare: () => listEditor(
      'How to prepare',
      data.prepare.steps,
      (item, i) =>
        field('Title', `prepare.steps.${i}.title`, item.title) +
        richField('Body', `prepare.steps.${i}.body`, item.body),
      styleFields('prepare', data.prepare.style)
    ),

    locations: () => listEditor(
      'Location cards',
      data.locations.items,
      (item, i) =>
        field('Slug (filename)', `locations.items.${i}.slug`, item.slug) +
        field('Title', `locations.items.${i}.title`, item.title),
      styleFields('locations', data.locations.style)
    ),

    faq: () => listEditor(
      'FAQs (shared for all locations)',
      data.faqs?.items || [],
      (item, i) =>
        field('Question', `faqs.items.${i}.question`, item.question) +
        richField('Answer', `faqs.items.${i}.answer`, item.answer),
      styleFields('faqs', data.faqs?.style)
    ),

    contact: () => `<fieldset data-section="contact"><legend>Contact</legend>
      ${styleFields('contact', data.contact.style)}
      ${field('Heading', 'contact.heading', data.contact.heading)}
      ${richField('Body', 'contact.body', data.contact.body)}
      ${field('Email', 'contact.email', data.contact.email)}
      ${field('Button text', 'contact.buttonText', data.contact.buttonText)}
    </fieldset>`,
  };

  let html = renderSectionSorter(data.sectionOrder, getIndexLabels(data));

  html += `<fieldset data-section="hero"><legend>Hero (fixed at top)</legend>
    ${field('Headline', 'hero.heading', data.hero.heading)}
    ${richField('Lead text', 'hero.lead', data.hero.lead)}
  </fieldset>`;

  data.sectionOrder.forEach((id) => {
    if (id.startsWith('custom:')) {
      const sid = id.replace('custom:', '');
      const si = (data.customSections || []).findIndex((s) => s.id === sid);
      if (si >= 0) html += renderCustomSectionForm(data.customSections[si], si);
    } else if (sectionForms[id]) {
      html += sectionForms[id]();
    }
  });

  html += customSectionsAddButton();
  return html;
}

function renderCustomSectionForm(section, si) {
  const prefix = `customSections.${si}`;
  let html = `<fieldset data-section="custom-${section.id}"><legend>${escapeAttr(section.heading || 'Custom section')}
    <button type="button" class="danger" style="float:right;font-size:0.75rem" data-action="remove-custom" data-i="${si}">Remove section</button></legend>
    ${styleFields(prefix, section.style)}
    ${field('Nav label', `${prefix}.navLabel`, section.navLabel)}
    ${field('Heading', `${prefix}.heading`, section.heading)}
    ${richField('Intro', `${prefix}.intro`, section.intro || '')}`;
  (section.blocks || []).forEach((b, bi) => {
    html += `<div class="item-card">
      <div class="item-card-header"><span>Block ${bi + 1}</span>
        <button type="button" data-action="remove-custom-block" data-si="${si}" data-bi="${bi}">Remove</button>
      </div>
      ${field('Icon', `${prefix}.blocks.${bi}.icon`, b.icon)}
      ${field('Title', `${prefix}.blocks.${bi}.title`, b.title)}
      ${richField('Content', `${prefix}.blocks.${bi}.body`, blockBodyHtml(b))}
    </div>`;
  });
  html += `<button type="button" class="add-btn" data-action="add-custom-block" data-si="${si}">+ Add content block</button></fieldset>`;
  return html;
}

function renderLocationForm(data) {
  ensureLocationSectionOrder(data);

  const sectionForms = {
    address: () => `<fieldset data-section="address"><legend>Address</legend>
      ${styleFields('address', data.address.style)}
      ${richField('Address', 'address.addressHtml', data.address.addressHtml, 'Use Enter for line breaks')}
      ${richField('Note', 'address.noteHtml', data.address.noteHtml || '')}
      ${field('Google Maps URL', 'address.mapsUrl', data.address.mapsUrl || '')}
    </fieldset>`,

    transit: () => infoBlocksEditor('transit', data.transit, 'Parking & transit'),
    zoom: () => infoBlocksEditor('zoom', data.zoom, 'Zoom setup'),

    arrival: () => infoBlocksEditor('arrival', data.arrival, 'Arrival & check-in'),

    registration: () => listEditor(
      'Registration cards',
      data.registration.cards,
      (item, i) =>
        field('Title', `registration.cards.${i}.title`, item.title) +
        richField('Body', `registration.cards.${i}.body`, item.body) +
        richField('Note (optional)', `registration.cards.${i}.note`, item.note || ''),
      styleFields('registration', data.registration.style)
    ),

    contact: () => `<fieldset data-section="contact"><legend>Contact</legend>
      ${styleFields('contact', data.contact.style)}
      ${richField('Body', 'contact.body', data.contact.body)}
      ${field('Email', 'contact.email', data.contact.email)}
    </fieldset>`,
  };

  let html = renderSectionSorter(data.sectionOrder, getLocationLabels(data));

  html += `<fieldset data-section="hero"><legend>Hero (fixed at top)</legend>
    ${field('Bar label', 'barLabel', data.barLabel)}
    ${field('Title', 'hero.title', data.hero.title)}
    ${field('Lead', 'hero.lead', data.hero.lead)}
    ${field('Photo placeholder', 'hero.photo', data.hero.photo)}
  </fieldset>`;

  data.sectionOrder.forEach((id) => {
    if (id.startsWith('custom:')) {
      const sid = id.replace('custom:', '');
      const si = (data.customSections || []).findIndex((s) => s.id === sid);
      if (si >= 0) html += renderCustomSectionForm(data.customSections[si], si);
    } else if (sectionForms[id]) {
      html += sectionForms[id]();
    }
  });

  html += customSectionsAddButton();
  return html;
}

function renderForm() {
  const isIndex = currentPage === 'index';
  if (isIndex) ensureIndexSectionOrder(content);
  else ensureLocationSectionOrder(content);
  formView.innerHTML = isIndex ? renderIndexForm(content) : renderLocationForm(content);
  bindFormInputs();
  bindListActions(isIndex);
  bindSectionDragDrop();
  bindRichEditors(formView, () => {
    syncContentFromForm();
    schedulePreview();
    setStatus('Unsaved changes');
  });
}

function bindListActions(isIndex) {
  formView.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      syncContentFromForm();
      const action = btn.dataset.action;
      const i = Number(btn.dataset.i);
      const legend = btn.closest('fieldset')?.querySelector('legend')?.textContent;

      if (action === 'add-block') {
        const key = btn.dataset.section;
        if (!content[key]) content[key] = { label: '', heading: '', blocks: [] };
        if (!content[key].blocks) content[key].blocks = [];
        content[key].blocks.push({
          icon: '📌',
          title: 'New block',
          paragraphs: [{ type: 'html', html: '' }],
        });
      } else if (action === 'remove-block') {
        const key = btn.dataset.section;
        content[key].blocks.splice(Number(btn.dataset.i), 1);
      } else if (action === 'add-custom-section') {
        const id = `cs-${Date.now().toString(36)}`;
        content.customSections.push({
          id,
          navLabel: 'New section',
          label: 'Section',
          heading: 'New content section',
          intro: '',
          blocks: [{ icon: '📌', title: 'New block', paragraphs: [{ type: 'html', html: '' }] }],
        });
        content.sectionOrder.push(`custom:${id}`);
      } else if (action === 'remove-custom') {
        const si = Number(btn.dataset.i);
        const removed = content.customSections.splice(si, 1)[0];
        if (removed) {
          content.sectionOrder = content.sectionOrder.filter((id) => id !== `custom:${removed.id}`);
        }
      } else if (action === 'add-custom-block') {
        const s = content.customSections[Number(btn.dataset.si)];
        s.blocks.push({ icon: '📌', title: 'New block', paragraphs: [{ type: 'html', html: '' }] });
      } else if (action === 'remove-custom-block') {
        content.customSections[Number(btn.dataset.si)].blocks.splice(Number(btn.dataset.bi), 1);
      } else if (action === 'add') {
        if (legend === 'How to prepare') content.prepare.steps.push({ title: '', body: '' });
        else if (legend === 'Location cards') content.locations.items.push({ slug: 'new-location', title: '', virtual: false });
        else if (legend === 'Registration cards') content.registration.cards.push({ title: '', body: '' });
        else if (legend === 'FAQs (shared for all locations)') content.faqs.items.push({ question: '', answer: '' });
      } else if (action === 'remove') {
        const lists = {
          'How to prepare': content.prepare.steps,
          'Location cards': content.locations.items,
          'Registration cards': content.registration.cards,
          'FAQs (shared for all locations)': content.faqs?.items,
        };
        lists[legend]?.splice(i, 1);
      } else if (action === 'up' || action === 'down') {
        const lists = {
          'How to prepare': content.prepare.steps,
          'Location cards': content.locations.items,
          'Registration cards': content.registration.cards,
          'FAQs (shared for all locations)': content.faqs?.items,
        };
        const arr = lists[legend];
        if (!arr) return;
        const j = action === 'up' ? i - 1 : i + 1;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }

      renderForm();
      refreshPreview();
      setStatus('Unsaved changes');
    });
  });
}

async function loadPages() {
  const pages = await api('/api/pages');
  const nav = $('#page-list');
  nav.innerHTML = pages
    .map(
      (p) =>
        `<button type="button" class="page-btn${p.id === currentPage ? ' active' : ''}" data-id="${p.id}">${escapeAttr(p.label)}</button>`
    )
    .join('');
  nav.querySelectorAll('.page-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectPage(btn.dataset.id));
  });
}

async function selectPage(id) {
  currentPage = id;
  content = await api(`/api/content/${id}`);
  if (currentPage === 'index') {
    if (!content.faqs) content.faqs = { label: 'Day-of', heading: 'FAQs', items: [] };
    ensureIndexSectionOrder(content);
  } else {
    ensureLocationSectionOrder(content);
  }
  jsonEditor.value = JSON.stringify(content, null, 2);
  renderForm();
  await loadPages();
  refreshPreview();
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 400);
}

async function refreshPreview() {
  try {
    syncContentFromForm();
    const html = await api('/api/preview-draft', {
      method: 'POST',
      body: JSON.stringify({ id: currentPage, data: content }),
    });
    setPreviewHtml(html);
    setStatus('Preview updated', 'ok');
  } catch (e) {
    try {
      setPreviewUrl(`/api/preview/${currentPage}?t=${Date.now()}`);
      setStatus(`Preview fallback: ${e.message}`, 'err');
    } catch {
      setStatus(`Preview failed: ${e.message}`, 'err');
    }
  }
}

async function save() {
  try {
    const jsonTabActive = document.querySelector('.tab[data-tab="json"]')?.classList.contains('active');
    if (jsonTabActive) {
      content = JSON.parse(jsonEditor.value);
      if (currentPage === 'index') ensureIndexSectionOrder(content);
      else ensureLocationSectionOrder(content);
    } else {
      syncContentFromForm();
    }
    await api(`/api/content/${currentPage}`, { method: 'PUT', body: JSON.stringify(content) });
    jsonEditor.value = JSON.stringify(content, null, 2);
    renderForm();
    await refreshPreview();
    setStatus('Saved & HTML rebuilt', 'ok');
  } catch (e) {
    setStatus(e.message, 'err');
  }
}

// Tabs
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const isJson = tab.dataset.tab === 'json';
    $('#form-view').classList.toggle('hidden', isJson);
    $('#json-view').classList.toggle('hidden', !isJson);
    if (isJson) {
      readFormIntoContent();
      jsonEditor.value = JSON.stringify(content, null, 2);
    } else {
      try {
        content = JSON.parse(jsonEditor.value);
        renderForm();
      } catch {
        setStatus('Fix JSON before switching to form', 'err');
      }
    }
  });
});

jsonEditor.addEventListener('input', () => {
  setStatus('Unsaved changes');
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    try {
      content = JSON.parse(jsonEditor.value);
      schedulePreview();
    } catch {
      /* invalid json */
    }
  }, 600);
});

$('#btn-save').addEventListener('click', save);
$('#btn-rebuild').addEventListener('click', async () => {
  await api('/api/build', { method: 'POST' });
  setStatus('All HTML rebuilt', 'ok');
});
$('#btn-refresh-preview').addEventListener('click', refreshPreview);
initPreviewModeToggle();

loadPages().then(() => selectPage('index'));
