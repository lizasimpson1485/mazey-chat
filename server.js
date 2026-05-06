const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GORGIAS_EMAIL = process.env.GORGIAS_EMAIL     || '';
const GORGIAS_KEY   = process.env.GORGIAS_API_KEY   || '';

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MIME = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.js':   'application/javascript',
  '.css':  'text/css',
};

function serveStatic(res, filePath) {
  try {
    const file = fs.readFileSync(filePath);
    const ext  = path.extname(filePath);
    res.writeHead(200, { ...cors, 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404, cors); res.end('Not found');
  }
}
  return new Promise((res, rej) => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => { try { res(JSON.parse(d)); } catch(e) { rej(e); } });
  });
}

http.createServer(async (req, res) => {

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors); res.end(); return;
  }

  // ── Serve static files ───────────────────────────────────
  if (req.method === 'GET') {
    const staticFiles = ['/index.html', '/', '/manifest.json', '/worm.png', '/logo.svg'];
    if (staticFiles.includes(req.url) || req.url === '/') {
      const fileName = req.url === '/' ? 'index.html' : req.url.slice(1);
      return serveStatic(res, path.join(__dirname, fileName));
    }
  }

  // ── Anthropic proxy ───────────────────────────────────────
  if (req.method === 'POST' && req.url === '/anthropic') {
    try {
      const body = await readBody(req);
      console.log('Anthropic request - key present:', !!ANTHROPIC_KEY, 'key prefix:', ANTHROPIC_KEY.slice(0,10));
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta':    'web-search-2025-03-05',
        },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      console.log('Anthropic response status:', r.status, 'error:', data.error);
      res.writeHead(r.status, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch(e) {
      console.error('Anthropic fetch error:', e.message);
      res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Gorgias proxy ─────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/gorgias') {
    try {
      const body = await readBody(req);
      const creds = Buffer.from(`${GORGIAS_EMAIL}:${GORGIAS_KEY}`).toString('base64');
      const r = await fetch('https://mazeproducts.gorgias.com/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Basic ${creds}`,
        },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      res.writeHead(r.status, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch(e) {
      res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, cors); res.end('Not found');

}).listen(PORT, () => console.log(`Mazey running on port ${PORT}`));
