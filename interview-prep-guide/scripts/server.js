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

function previewHtml(id) {
  const { buildIndex, buildLocation } = getBuilder();
  if (id === 'index') {
    const data = JSON.parse(fs.readFileSync(contentPath('index.json'), 'utf8'));
    let html = buildIndex(data);
    html = html.replace('href="css/site.css"', 'href="/css/site.css"');
    html = html.replace(/href="locations\//g, 'href="/locations/');
    html = html.replace('src="js/nav-dialkit.js"', 'src="/js/nav-dialkit.js"');
    return html;
  }
  const data = JSON.parse(fs.readFileSync(contentPath('locations', `${id}.json`), 'utf8'));
  let html = buildLocation(data);
  html = html.replace('href="../css/site.css"', 'href="/css/site.css"');
  html = html.replace('href="../index.html"', 'href="/api/preview/index"');
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
      getBuilder().buildAll();
      send(res, 200, JSON.stringify({ ok: true, message: 'Saved and rebuilt HTML.' }));
      return;
    }

    if (url.pathname === '/api/preview-draft' && req.method === 'POST') {
      const body = await readBody(req);
      const { id, data } = body;
      const { buildIndex, buildLocation } = getBuilder();
      let html;
      if (id === 'index') {
        html = buildIndex(data);
        html = html.replace('href="css/site.css"', 'href="/css/site.css"');
        html = html.replace(/href="locations\//g, 'href="/locations/');
        html = html.replace('src="js/nav-dialkit.js"', 'src="/js/nav-dialkit.js"');
      } else {
        html = buildLocation(data);
        html = html.replace('href="../css/site.css"', 'href="/css/site.css"');
        html = html.replace('href="../index.html"', 'href="/api/preview/index"');
      }
      send(res, 200, html, 'text/html');
      return;
    }

    if (url.pathname.startsWith('/api/preview/') && req.method === 'GET') {
      const id = url.pathname.split('/').pop();
      try {
        send(res, 200, previewHtml(id), 'text/html');
      } catch {
        send(res, 404, 'Preview not found', 'text/plain');
      }
      return;
    }

    if (url.pathname === '/api/build' && req.method === 'POST') {
      const result = getBuilder().buildAll();
      send(res, 200, JSON.stringify({ ok: true, ...result }));
      return;
    }

    // Static: site assets for preview
    if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/locations/') || url.pathname.startsWith('/js/')) {
      const siteFile = path.join(ROOT, url.pathname);
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

server.listen(PORT, () => {
  console.log(`\n  Interview Prep Editor`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  Edit content in the browser, save to update JSON + HTML files.`);
  console.log(`  Push to GitHub when ready to deploy to Netlify.\n`);
});
