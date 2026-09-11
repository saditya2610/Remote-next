// ============================================================
// server/signaling-server.js — NexLink WebSocket Signaling
// ============================================================
// Run: node server/signaling-server.js
// Default port: 3000

const { WebSocketServer } = require('ws');
const os  = require('os');
const net = require('net');

const PORT = process.env.PORT || 3000;
const wss  = new WebSocketServer({ port: PORT });

// ─── Session registry ────────────────────────────────────────
// { hostId: { host: ws, client: ws|null, password: string } }
const sessions = new Map();
// { ws → { role, hostId, clientId } }
const clients  = new Map();

function getLocalIP() {
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

function send(ws, obj) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(obj));
}

function log(...args) {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...args);
}

// ─── Connection handler ───────────────────────────────────────
wss.on('connection', (ws) => {
  log('New WS connection');
  clients.set(ws, {});

  // Ping keepalive
  const ping = setInterval(() => {
    if (ws.readyState === 1) ws.ping();
    else clearInterval(ping);
  }, 20000);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const ctx = clients.get(ws);

    switch (msg.type) {

      // ── Host registers ──────────────────────────────────────
      case 'host-register': {
        const id  = msg.id || Math.floor(100000000 + Math.random() * 900000000).toString();
        const pwd = msg.password || Math.random().toString(36).slice(2, 10);

        // Clean up any previous session with same ID
        if (sessions.has(id)) {
          const old = sessions.get(id);
          send(old.host, { type: 'evicted', reason: 'New host registered with same ID' });
          sessions.delete(id);
        }

        sessions.set(id, { host: ws, client: null, password: pwd });
        ctx.role   = 'host';
        ctx.hostId = id;

        send(ws, { type: 'host-registered', id, password: pwd });
        log(`Host registered: ${id}`);
        break;
      }

      // ── Client requests connection ───────────────────────────
      case 'client-connect': {
        const { hostId, password } = msg;
        const session = sessions.get(hostId);

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

        session.client    = ws;
        ctx.role          = 'client';
        ctx.hostId        = hostId;

        // Notify host
        send(session.host, { type: 'client-joined' });
        // Notify client
        send(ws, { type: 'host-ready' });
        log(`Client connected to host: ${hostId}`);
        break;
      }

      // ── WebRTC signaling relay ───────────────────────────────
      case 'offer': {
        const session = sessions.get(ctx.hostId);
        if (session?.host) send(session.host, { type: 'offer', sdp: msg.sdp });
        break;
      }
      case 'answer': {
        const session = sessions.get(ctx.hostId);
        if (session?.client) send(session.client, { type: 'answer', sdp: msg.sdp });
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

  ws.on('close', () => {
    clearInterval(ping);
    const ctx = clients.get(ws);
    if (ctx?.hostId) {
      const session = sessions.get(ctx.hostId);
      if (session) {
        if (ctx.role === 'host') {
          send(session.client, { type: 'host-disconnected' });
          sessions.delete(ctx.hostId);
          log(`Host disconnected: ${ctx.hostId}`);
        } else {
          session.client = null;
          send(session.host, { type: 'client-disconnected' });
          log(`Client disconnected from: ${ctx.hostId}`);
        }
      }
    }
    clients.delete(ws);
  });

  ws.on('error', (err) => log('WS error:', err.message));
});

// ─── Start ───────────────────────────────────────────────────
const localIP = getLocalIP();
console.log('╔════════════════════════════════════════╗');
console.log('║     NexLink Signaling Server v1.0      ║');
console.log('╠════════════════════════════════════════╣');
console.log(`║  Local :  ws://localhost:${PORT}           ║`);
console.log(`║  LAN   :  ws://${localIP}:${PORT}`.padEnd(42) + '║');
console.log('╠════════════════════════════════════════╣');
console.log('║  Share the LAN address with Client     ║');
console.log('╚════════════════════════════════════════╝');
