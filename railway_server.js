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

async function readBody(req) {
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

  // ── Serve index.html ──────────────────────────────────────
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const file = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { ...cors, 'Content-Type': 'text/html' });
    res.end(file); return;
  }

  // ── Serve manifest.json ───────────────────────────────────
  if (req.method === 'GET' && req.url === '/manifest.json') {
    const file = fs.readFileSync(path.join(__dirname, 'manifest.json'));
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(file); return;
  }

  // ── Anthropic proxy ───────────────────────────────────────
  if (req.method === 'POST' && req.url === '/anthropic') {
    try {
      const body = await readBody(req);
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-api-key':       ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta':  'web-search-2025-03-05',
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
