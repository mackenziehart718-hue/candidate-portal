#!/usr/bin/env node
/**
 * Local editor server — NOT for production deploy.
 * Run: npm run editor
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ROOT, contentPath } = require('./lib/utils');

const PORT = process.env.PORT || 3456;
const EDITOR_DIR = path.join(ROOT, 'editor');
const BUILD_PATH = path.join(__dirname, 'build.js');
const SECTIONS_PATH = path.join(__dirname, 'lib', 'sections.js');

/** Reload build + section helpers on each use so preview/save pick up script changes. */
function getBuilder() {
  delete require.cache[require.resolve(SECTIONS_PATH)];
  delete require.cache[require.resolve(BUILD_PATH)];
  return require(BUILD_PATH);
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function listPages() {
  const pages = [{ id: 'index', label: 'Main hub', type: 'index' }];
  const locDir = contentPath('locations');
  if (fs.existsSync(locDir)) {
    fs.readdirSync(locDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .forEach((f) => {
        const slug = f.replace('.json', '');
        const data = JSON.parse(fs.readFileSync(path.join(locDir, f), 'utf8'));
        pages.push({
          id: slug,
          label: data.hero?.title || slug,
          type: 'location',
        });
      });
  }
  return pages;
}

function contentFile(id) {
  if (id === 'index') return contentPath('index.json');
  return contentPath('locations', `${id}.json`);
}

function serveStatic(filePath, res) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, 'Not found', 'text/plain');
    return;
  }
  const ext = path.extname(filePath);
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function previewHtml(id, options = {}) {
  const { buildIndex, buildLocation } = getBuilder();
  if (id === 'index') {
    const data = JSON.parse(fs.readFileSync(contentPath('index.json'), 'utf8'));
    let html = buildIndex(data);
    html = html.replace('href="css/site.css"', 'href="/css/site.css"');
    html = html.replace(/href="locations\//g, 'href="/locations/');
    html = html.replace('src="js/nav-dialkit.js"', 'src="/js/nav-dialkit.js"');
    html = html.replace('src="js/nav-scroll.js"', 'src="/js/nav-scroll.js"');
    html = html.replace(/src="icons\//g, 'src="/icons/');
    return html;
  }
  const data = JSON.parse(fs.readFileSync(contentPath('locations', `${id}.json`), 'utf8'));
  let html = buildLocation(data, { editable: !!options.editable });
  html = html.replace('href="../css/site.css"', 'href="/css/site.css"');
  html = html.replace('href="../index.html"', 'href="/api/preview/index"');
  html = html.replace('src="../js/nav-scroll.js"', 'src="/js/nav-scroll.js"');
  if (options.editable) html = injectEditablePreview(html);
  return html;
}

function injectEditablePreview(html) {
  const cssPath = path.join(EDITOR_DIR, 'preview-edit.css');
  const jsPath = path.join(EDITOR_DIR, 'preview-edit.js');
  const css = fs.readFileSync(cssPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');
  return html
    .replace('</head>', `  <style>${css}</style>\n</head>`)
    .replace('</body>', `  <script>${js}</script>\n</body>`);
}

function locationPreviewHtml(data, editable = false) {
  const { buildLocation } = getBuilder();
  let html = buildLocation(data, { editable });
  html = html.replace('href="../css/site.css"', 'href="/css/site.css"');
  html = html.replace('href="../index.html"', 'href="/api/preview/index"');
  html = html.replace('src="../js/nav-scroll.js"', 'src="/js/nav-scroll.js"');
  if (editable) html = injectEditablePreview(html);
  return html;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }

  try {
    if (url.pathname === '/api/pages' && req.method === 'GET') {
      send(res, 200, JSON.stringify(listPages()));
      return;
    }

    if (url.pathname.startsWith('/api/content/') && req.method === 'GET') {
      const id = url.pathname.split('/').pop();
      const file = contentFile(id);
      if (!fs.existsSync(file)) return send(res, 404, JSON.stringify({ error: 'Not found' }));
      send(res, 200, fs.readFileSync(file, 'utf8'), 'application/json');
      return;
    }

    if (url.pathname.startsWith('/api/content/') && req.method === 'PUT') {
      const id = url.pathname.split('/').pop();
      const body = await readBody(req);
      const file = contentFile(id);
      fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n', 'utf8');
      const excludeSlugs = id === 'redwood-city' ? [] : ['redwood-city'];
      getBuilder().buildAll({ excludeSlugs, skipIndex: true });
      const message =
        id === 'redwood-city'
          ? 'Saved Redwood City JSON + HTML.'
          : 'Saved JSON + HTML (other cities only; Redwood City unchanged).';
      send(res, 200, JSON.stringify({ ok: true, message }));
      return;
    }

    if (url.pathname === '/api/preview-draft' && req.method === 'POST') {
      const body = await readBody(req);
      const { id, data, editable } = body;
      const { buildIndex } = getBuilder();
      let html;
      if (id === 'index') {
        html = buildIndex(data);
        html = html.replace('href="css/site.css"', 'href="/css/site.css"');
        html = html.replace(/href="locations\//g, 'href="/locations/');
        html = html.replace('src="js/nav-dialkit.js"', 'src="/js/nav-dialkit.js"');
        html = html.replace('src="js/nav-scroll.js"', 'src="/js/nav-scroll.js"');
        html = html.replace(/src="icons\//g, 'src="/icons/');
      } else {
        html = locationPreviewHtml(data, !!editable);
      }
      send(res, 200, html, 'text/html');
      return;
    }

    if (url.pathname.startsWith('/api/preview/') && req.method === 'GET') {
      const id = url.pathname.split('/').pop();
      const editable = url.searchParams.get('editable') === '1';
      try {
        send(res, 200, previewHtml(id, { editable }), 'text/html');
      } catch {
        send(res, 404, 'Preview not found', 'text/plain');
      }
      return;
    }

    if (url.pathname === '/api/build' && req.method === 'POST') {
      const body = await readBody(req);
      const excludeSlugs = Array.isArray(body.excludeSlugs) ? body.excludeSlugs : ['redwood-city'];
      const result = getBuilder().buildAll({ excludeSlugs });
      send(res, 200, JSON.stringify({ ok: true, ...result }));
      return;
    }

    // Static: site assets for preview
    if (
      url.pathname === '/index.html' ||
      url.pathname.startsWith('/css/') ||
      url.pathname.startsWith('/locations/') ||
      url.pathname.startsWith('/js/') ||
      url.pathname.startsWith('/icons/')
    ) {
      const siteFile = path.join(ROOT, decodeURIComponent(url.pathname));
      serveStatic(siteFile, res);
      return;
    }

    // Editor static files
    let editorPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.join(EDITOR_DIR, editorPath);
    if (file.startsWith(EDITOR_DIR)) {
      serveStatic(file, res);
      return;
    }

    send(res, 404, 'Not found', 'text/plain');
  } catch (err) {
    console.error(err);
    send(res, 500, JSON.stringify({ error: err.message }));
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use — the editor is probably already running.`);
    console.error(`  Open http://localhost:${PORT} in your browser.`);
    console.error(`  Or stop the other copy (Ctrl+C in that terminal), or run:`);
    console.error(`  PORT=3457 npm run editor\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`\n  Interview Prep Editor`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  Edit content in the browser, save to update JSON + HTML files.`);
  console.log(`  Push to GitHub when ready to deploy to Netlify.\n`);
});
