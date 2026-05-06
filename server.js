const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT          = process.env.PORT          || 3000;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GORGIAS_EMAIL = process.env.GORGIAS_EMAIL     || '';
const GORGIAS_KEY   = process.env.GORGIAS_API_KEY   || '';

const CORS = {
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function serveFile(res, filePath) {
  try {
    const file = fs.readFileSync(filePath);
    const ext  = path.extname(filePath);
    res.writeHead(200, { ...CORS, 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404, CORS);
    res.end('Not found');
  }
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  console.log(req.method, req.url);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // Static files
  if (req.method === 'GET') {
    const urlMap = {
      '/':             'index.html',
      '/index.html':   'index.html',
      '/manifest.json':'manifest.json',
      '/worm.png':     'worm.png',
      '/logo.svg':     'logo.svg',
    };
    if (urlMap[req.url]) {
      return serveFile(res, path.join(__dirname, urlMap[req.url]));
    }
    res.writeHead(404, CORS);
    res.end('Not found');
    return;
  }

  // Anthropic proxy
  if (req.method === 'POST' && req.url === '/anthropic') {
    try {
      const body = await readBody(req);
      console.log('Calling Anthropic, key present:', !!ANTHROPIC_KEY);
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
      console.log('Anthropic status:', r.status);
      return jsonResponse(res, r.status, data);
    } catch(e) {
      console.error('Anthropic error:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // Gorgias proxy
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
      console.log('Gorgias status:', r.status);
      return jsonResponse(res, r.status, data);
    } catch(e) {
      console.error('Gorgias error:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  res.writeHead(405, CORS);
  res.end('Method not allowed');
});

server.listen(PORT, () => console.log(`Mazey running on port ${PORT}`));
