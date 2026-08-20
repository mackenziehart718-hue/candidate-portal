const INDEX_SECTION_NAV = {
  welcome: 'About',
  prepare: 'Before',
  links: 'Explore',
  faq: 'Day-of',
  locations: 'Locations',
  contact: 'Contact',
};

const INDEX_SECTION_LABELS = {
  welcome: 'Welcome',
  prepare: 'How to prepare',
  links: 'Helpful links',
  faq: 'FAQs',
  locations: 'Location cards',
  contact: 'Contact',
};

const DEFAULT_INDEX_SECTION_ORDER = [
  'welcome',
  'prepare',
  'links',
  'locations',
  'faq',
  'contact',
];

const LOCATION_SECTION_NAV = {
  address: 'Address',
  transit: 'Parking & transit',
  zoom: 'Zoom setup',
  gettingHere: 'Getting here',
  arrival: 'Arrival',
  registration: 'Registration',
  contact: 'Contact',
};

const LOCATION_SECTION_LABELS = {
  address: 'Address',
  transit: 'Parking & transit',
  zoom: 'Zoom setup',
  gettingHere: 'Getting here',
  arrival: 'Arrival & check-in',
  registration: 'Registration cards',
  contact: 'Contact',
};

function customSectionId(entry) {
  return `custom:${entry.id}`;
}

function getIndexCustomSections(data) {
  return Array.isArray(data.customSections) ? data.customSections : [];
}

function getLocationCustomSections(data) {
  return Array.isArray(data.customSections) ? data.customSections : [];
}

function indexSectionLabels(data) {
  const labels = { ...INDEX_SECTION_LABELS };
  getIndexCustomSections(data).forEach((s) => {
    labels[customSectionId(s)] = s.navLabel || s.heading || 'Custom section';
  });
  return labels;
}

function locationSectionLabels(data) {
  const labels = { ...LOCATION_SECTION_LABELS };
  getLocationCustomSections(data).forEach((s) => {
    labels[customSectionId(s)] = s.navLabel || s.heading || 'Custom section';
  });
  return labels;
}

function normalizeOrder(order, available, fallback) {
  const base = Array.isArray(order) && order.length ? [...order] : [...fallback];
  const seen = new Set();
  const result = [];
  base.forEach((id) => {
    if (available.has(id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  });
  fallback.forEach((id) => {
    if (available.has(id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  });
  return result;
}

function getIndexSectionOrder(data) {
  const available = new Set(DEFAULT_INDEX_SECTION_ORDER);
  getIndexCustomSections(data).forEach((s) => available.add(customSectionId(s)));
  return normalizeOrder(data.sectionOrder, available, DEFAULT_INDEX_SECTION_ORDER);
}

function getLocationAvailableSections(data) {
  const ids = ['address', 'registration', 'contact'];
  if (data.zoom) ids.push('zoom');
  else if (data.gettingHere) ids.push('gettingHere');
  else if (data.transit) ids.push('transit');
  if (data.arrival) ids.push('arrival');
  getLocationCustomSections(data).forEach((s) => ids.push(customSectionId(s)));
  return new Set(ids);
}

function getLocationSectionOrder(data) {
  const available = getLocationAvailableSections(data);
  const middle = data.zoom ? 'zoom' : data.gettingHere ? 'gettingHere' : 'transit';
  const defaultOrder = ['address', middle];
  if (data.arrival) defaultOrder.push('arrival');
  defaultOrder.push('registration', 'contact');
  getLocationCustomSections(data).forEach((s) => defaultOrder.push(customSectionId(s)));
  return normalizeOrder(data.sectionOrder, available, defaultOrder);
}

function buildIndexNav(sectionOrder, data) {
  const labels = { ...INDEX_SECTION_NAV };
  getIndexCustomSections(data).forEach((s) => {
    labels[customSectionId(s)] = s.navLabel || s.heading || 'More';
  });
  const links = sectionOrder.map((id) => `      <a href="#${id.replace('custom:', 'custom-')}">${labels[id] || id}</a>`);
  return ['      <a href="#top">Video</a>', ...links].join('\n');
}

function buildLocationNav(sectionOrder, data) {
  const labels = { ...LOCATION_SECTION_NAV };
  (data.nav || []).forEach((n) => {
    if (n && n.id && n.label) labels[n.id] = n.label;
  });
  getLocationCustomSections(data).forEach((s) => {
    labels[customSectionId(s)] = s.navLabel || s.heading || 'More';
  });
  return sectionOrder
    .map((id) => `      <a href="#${id.replace('custom:', 'custom-')}">${labels[id] || id}</a>`)
    .join('\n');
}

module.exports = {
  INDEX_SECTION_NAV,
  INDEX_SECTION_LABELS,
  DEFAULT_INDEX_SECTION_ORDER,
  LOCATION_SECTION_NAV,
  LOCATION_SECTION_LABELS,
  customSectionId,
  getIndexCustomSections,
  getLocationCustomSections,
  indexSectionLabels,
  locationSectionLabels,
  getIndexSectionOrder,
  getLocationSectionOrder,
  getLocationAvailableSections,
  buildIndexNav,
  buildLocationNav,
};
