const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

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

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
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
  try {
    console.log(req.method, req.url);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS); res.end(); return;
  }

  // Static files
  if (req.method === 'GET') {
    const map = {
      '/':              'index.html',
      '/index.html':    'index.html',
      '/manifest.json': 'manifest.json',
      '/worm.png':      'worm.png',
      '/logo.svg':      'logo.svg',
    };
    if (map[req.url]) return serveFile(res, path.join(__dirname, map[req.url]));
    res.writeHead(404, CORS); res.end('Not found'); return;
  }

  // Anthropic proxy
  if (req.method === 'POST' && (req.url === '/anthropic' || req.url === '/anthropic/')) {
    try {
      const body = await readBody(req);
      console.log('Calling Anthropic, key present:', !!ANTHROPIC_KEY);
      const r = await httpsPost(
        'api.anthropic.com',
        '/v1/messages',
        {
          'Content-Type':      'application/json',
          'x-api-key':         ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta':    'web-search-2025-03-05',
        },
        body
      );
      console.log('Anthropic status:', r.status);
      return jsonResponse(res, r.status, r.body);
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
      const r = await httpsPost(
        'mazeproducts.gorgias.com',
        '/api/tickets',
        {
          'Content-Type':  'application/json',
          'Authorization': `Basic ${creds}`,
        },
        body
      );
      console.log('Gorgias status:', r.status);
      return jsonResponse(res, r.status, r.body);
    } catch(e) {
      console.error('Gorgias error:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  res.writeHead(405, CORS); res.end('Method not allowed');
  } catch(e) {
    console.error('Server error:', e.message);
    res.writeHead(500, CORS); res.end('Server error: ' + e.message);
  }
});

server.listen(PORT, () => console.log(`Mazey running on port ${PORT}`));
