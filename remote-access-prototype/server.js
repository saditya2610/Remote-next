// ============================================================
// server.js — NexLink Combined HTTP + WebSocket Server
// ============================================================
// Jalankan: node server.js
// Kemudian buka browser di laptop lain: http://<IP-LAN>:3000
// ============================================================

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { WebSocketServer } = require('ws');

const PORT    = process.env.PORT || 3000;
const ROOT    = __dirname; // Serve files from project root

// ─── MIME Types ───────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

// ─── HTTP Server ──────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  // Normalize URL: strip query string, decode
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Root → index.html
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // Security: prevent directory traversal
  const safePath = path.normalize(path.join(ROOT, urlPath));
  if (!safePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  // Serve file
  fs.readFile(safePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found: ' + urlPath);
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }
    const ext  = path.extname(safePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type':  mime,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

// ─── WebSocket Signaling (attached to same HTTP server) ───────
const wss = new WebSocketServer({ server: httpServer });

// Session registry: { hostId => { host: ws, client: ws|null, password: string } }
const sessions = new Map();
// Per-socket context: { ws => { role, hostId } }
const clients  = new Map();

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function log() {
  const args = Array.prototype.slice.call(arguments);
  args.unshift('[' + new Date().toLocaleTimeString() + ']');
  console.log.apply(console, args);
}

wss.on('connection', function(ws, req) {
  const origin = req.socket.remoteAddress;
  log('New WS connection from', origin);
  clients.set(ws, {});

  // Keepalive ping every 20s
  const ping = setInterval(function() {
    if (ws.readyState === 1) ws.ping();
    else clearInterval(ping);
  }, 20000);

  ws.on('message', function(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    const ctx = clients.get(ws);

    switch (msg.type) {

      // Host registers
      case 'host-register': {
        const id  = msg.id || String(Math.floor(100000000 + Math.random() * 900000000));
        const pwd = msg.password || Math.random().toString(36).slice(2, 10);

        if (sessions.has(id)) {
          const old = sessions.get(id);
          send(old.host, { type: 'evicted', reason: 'New host registered with same ID' });
          sessions.delete(id);
        }

        sessions.set(id, { host: ws, client: null, password: pwd });
        ctx.role   = 'host';
        ctx.hostId = id;

        send(ws, { type: 'host-registered', id: id, password: pwd });
        log('Host registered:', id);
        break;
      }

      // Client requests connection
      case 'client-connect': {
        const hostId   = msg.hostId;
        const password = msg.password;
        const session  = sessions.get(hostId);

        if (!session) {
          send(ws, { type: 'error', code: 'HOST_NOT_FOUND', message: 'Host tidak ditemukan atau offline' });
          return;
        }
        if (session.password && password !== session.password) {
          send(ws, { type: 'error', code: 'WRONG_PASSWORD', message: 'Password salah' });
          return;
        }
        if (session.client) {
          send(ws, { type: 'error', code: 'HOST_BUSY', message: 'Host sedang digunakan klien lain' });
          return;
        }

        session.client = ws;
        ctx.role       = 'client';
        ctx.hostId     = hostId;

        send(session.host, { type: 'client-joined' });
        send(ws,           { type: 'host-ready' });
        log('Client connected to host:', hostId);
        break;
      }

      // WebRTC signaling relay
      case 'offer': {
        const session = sessions.get(ctx.hostId);
        if (session && session.host) send(session.host, { type: 'offer', sdp: msg.sdp });
        break;
      }
      case 'answer': {
        const session = sessions.get(ctx.hostId);
        if (session && session.client) send(session.client, { type: 'answer', sdp: msg.sdp });
        break;
      }
      case 'ice': {
        const session = sessions.get(ctx.hostId);
        if (!session) return;
        const target = ctx.role === 'host' ? session.client : session.host;
        send(target, { type: 'ice', candidate: msg.candidate });
        break;
      }
    }
  });

  ws.on('close', function() {
    clearInterval(ping);
    const ctx = clients.get(ws);
    if (ctx && ctx.hostId) {
      const session = sessions.get(ctx.hostId);
      if (session) {
        if (ctx.role === 'host') {
          send(session.client, { type: 'host-disconnected' });
          sessions.delete(ctx.hostId);
          log('Host disconnected:', ctx.hostId);
        } else {
          session.client = null;
          send(session.host, { type: 'client-disconnected' });
          log('Client disconnected from:', ctx.hostId);
        }
      }
    }
    clients.delete(ws);
  });

  ws.on('error', function(err) { log('WS error:', err.message); });
});

// ─── Get LAN IP (skip virtual adapters like VMware/VirtualBox) ─
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(ifaces)) {
    // Skip known virtual adapters
    const nameLower = name.toLowerCase();
    if (nameLower.includes('vmware') || nameLower.includes('vbox') ||
        nameLower.includes('virtual') || nameLower.includes('loopback') ||
        nameLower.includes('bluetooth')) continue;

    for (const iface of ifaces[name]) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      // Skip VMware subnet (192.168.56.x) and link-local (169.254.x.x)
      if (iface.address.startsWith('169.254')) continue;
      if (iface.address.startsWith('192.168.56')) continue;
      candidates.push({ name, address: iface.address });
    }
  }

  if (candidates.length > 0) return candidates[0].address;

  // Fallback: return any non-internal IPv4
  for (const ifaces2 of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces2) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}


// ─── Start ────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', function() {
  const ip = getLocalIP();
  const pad = function(s, n) { while (s.length < n) s += ' '; return s; };
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║          NexLink Server — Ready                      ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  ' + pad('Lokal   : http://localhost:' + PORT, 52) + '║');
  console.log('║  ' + pad('LAN     : http://' + ip + ':' + PORT, 52) + '║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Bagikan URL LAN ke laptop/HP lain di WiFi yang sama ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  ' + pad('WS Host : ws://' + ip + ':' + PORT, 52) + '║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});
