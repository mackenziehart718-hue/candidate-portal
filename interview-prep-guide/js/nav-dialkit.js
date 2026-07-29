/**
 * Nav DialKit — live control panel for tuning the .page-nav CSS custom properties.
 * Dev tool only: hidden by default, toggled via the 🎛 tab (bottom-right) or Alt+D.
 * Changes persist to localStorage so they survive reloads; "Reset" clears them.
 */
(function () {
  var STORAGE_KEY = 'nav-dialkit-v1';
  var root = document.documentElement;

  var CONTROLS = [
    { key: '--nav-bg-opacity', label: 'Background opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.92, unit: '' },
    { key: '--nav-blur', label: 'Backdrop blur', type: 'range', min: 0, max: 24, step: 1, default: 8, unit: 'px' },
    { key: '--nav-gap', label: 'Link gap', type: 'range', min: 0, max: 4, step: 0.05, default: 1.75, unit: 'rem' },
    { key: '--nav-font-size', label: 'Font size', type: 'range', min: 0.7, max: 1.3, step: 0.01, default: 0.92, unit: 'rem' },
    { key: '--nav-font-weight', label: 'Font weight', type: 'range', min: 400, max: 800, step: 100, default: 600, unit: '' },
    { key: '--nav-letter-spacing', label: 'Letter spacing', type: 'range', min: -0.05, max: 0.05, step: 0.005, default: -0.01, unit: 'em' },
    { key: '--nav-padding-y', label: 'Bar height (padding-y)', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1.05, unit: 'rem' },
    { key: '--nav-underline-height', label: 'Underline height', type: 'range', min: 0, max: 6, step: 1, default: 2, unit: 'px' },
    { key: '--nav-text-color', label: 'Text color', type: 'color', default: '#212121' },
    { key: '--nav-hover-color', label: 'Hover color', type: 'color', default: '#0061D3' },
    { key: '--nav-underline-color', label: 'Underline color', type: 'color', default: '#0061D3' },
    { key: '--nav-border-color', label: 'Border color', type: 'color', default: '#D0D0D0' },
  ];

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function save(values) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  }

  function apply(key, rawValue, unit) {
    root.style.setProperty(key, unit ? rawValue + unit : rawValue);
  }

  var saved = loadSaved();
  CONTROLS.forEach(function (c) {
    var value = saved[c.key] !== undefined ? saved[c.key] : c.default;
    apply(c.key, value, c.unit);
  });

  var style = document.createElement('style');
  style.textContent = `
    #nav-dialkit-tab {
      position: fixed; bottom: 1rem; right: 1rem; z-index: 999998;
      width: 40px; height: 40px; border-radius: 50%;
      background: #113053; color: #fff; border: none; cursor: pointer;
      font-size: 1.1rem; box-shadow: 0 2px 10px rgba(0,0,0,0.25);
    }
    #nav-dialkit-panel {
      position: fixed; top: 1rem; right: 1rem; z-index: 999999;
      width: 260px; max-height: calc(100vh - 2rem); overflow-y: auto;
      background: #16233a; color: #e7edf5; font-family: 'Inter', system-ui, sans-serif;
      border-radius: 10px; padding: 0.85rem 0.9rem; box-shadow: 0 8px 30px rgba(0,0,0,0.35);
      display: none;
    }
    #nav-dialkit-panel.open { display: block; }
    #nav-dialkit-panel h3 { font-size: 0.82rem; font-weight: 600; margin: 0 0 0.6rem; color: #91C2FD; }
    #nav-dialkit-panel .row { margin-bottom: 0.6rem; }
    #nav-dialkit-panel label { display: flex; justify-content: space-between; font-size: 0.72rem; color: #a9b8cc; margin-bottom: 0.2rem; }
    #nav-dialkit-panel input[type="range"] { width: 100%; }
    #nav-dialkit-panel input[type="color"] { width: 100%; height: 24px; border: none; border-radius: 4px; background: none; padding: 0; }
    #nav-dialkit-panel .val { color: #fff; font-variant-numeric: tabular-nums; }
    #nav-dialkit-panel button.reset {
      width: 100%; margin-top: 0.4rem; padding: 0.4rem; border-radius: 6px; border: 1px solid #2c3f5c;
      background: transparent; color: #e7edf5; cursor: pointer; font-size: 0.75rem;
    }
    #nav-dialkit-panel button.reset:hover { background: #1e2f4a; }
  `;
  document.head.appendChild(style);

  var panel = document.createElement('div');
  panel.id = 'nav-dialkit-panel';
  panel.innerHTML = '<h3>Nav Bar</h3>' + CONTROLS.map(function (c, i) {
    var value = saved[c.key] !== undefined ? saved[c.key] : c.default;
    if (c.type === 'color') {
      return '<div class="row"><label>' + c.label + '</label>' +
        '<input type="color" data-idx="' + i + '" value="' + value + '"></div>';
    }
    return '<div class="row"><label>' + c.label + ' <span class="val" data-val-idx="' + i + '">' + value + c.unit + '</span></label>' +
      '<input type="range" data-idx="' + i + '" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '" value="' + value + '"></div>';
  }).join('') + '<button class="reset" type="button">Reset to defaults</button>';
  document.body.appendChild(panel);

  var tab = document.createElement('button');
  tab.id = 'nav-dialkit-tab';
  tab.type = 'button';
  tab.title = 'Nav DialKit (Alt+D)';
  tab.textContent = '🎛';
  document.body.appendChild(tab);

  function toggle() {
    panel.classList.toggle('open');
  }
  tab.addEventListener('click', toggle);
  document.addEventListener('keydown', function (e) {
    if (e.altKey && (e.key === 'd' || e.key === 'D')) toggle();
  });

  panel.addEventListener('input', function (e) {
    var idx = e.target.getAttribute('data-idx');
    if (idx === null) return;
    var c = CONTROLS[Number(idx)];
    var value = e.target.value;
    apply(c.key, value, c.unit);
    var label = panel.querySelector('[data-val-idx="' + idx + '"]');
    if (label) label.textContent = value + c.unit;
    var current = loadSaved();
    current[c.key] = value;
    save(current);
  });

  panel.querySelector('button.reset').addEventListener('click', function () {
    localStorage.removeItem(STORAGE_KEY);
    CONTROLS.forEach(function (c, i) {
      apply(c.key, c.default, c.unit);
      var input = panel.querySelector('[data-idx="' + i + '"]');
      if (input) input.value = c.default;
      var label = panel.querySelector('[data-val-idx="' + i + '"]');
      if (label) label.textContent = c.default + c.unit;
    });
  });
})();
