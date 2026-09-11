// ============================================================
// host-session.js — NexLink Host WebRTC Engine
// ============================================================

// ─── State ───────────────────────────────────────────────────
let ws          = null;
let pc          = null;       // RTCPeerConnection
let localStream = null;
let selectedSourceId = null;
let hostId      = null;
let hostPw      = null;
let sessionStart= null;
let statsTimer  = null;
let timeTimer   = null;
const API       = window.electronAPI || null;

// JS key → Windows Virtual Key code map
const VK = {
  'Backspace':8,'Tab':9,'Enter':13,'Shift':16,'Control':17,'Alt':18,
  'CapsLock':20,'Escape':27,' ':32,'PageUp':33,'PageDown':34,
  'End':35,'Home':36,'ArrowLeft':37,'ArrowUp':38,'ArrowRight':39,'ArrowDown':40,
  'Insert':45,'Delete':46,
  '0':48,'1':49,'2':50,'3':51,'4':52,'5':53,'6':54,'7':55,'8':56,'9':57,
  'a':65,'b':66,'c':67,'d':68,'e':69,'f':70,'g':71,'h':72,'i':73,'j':74,
  'k':75,'l':76,'m':77,'n':78,'o':79,'p':80,'q':81,'r':82,'s':83,'t':84,
  'u':85,'v':86,'w':87,'x':88,'y':89,'z':90,
  'Meta':91,'ContextMenu':93,
  'F1':112,'F2':113,'F3':114,'F4':115,'F5':116,'F6':117,
  'F7':118,'F8':119,'F9':120,'F10':121,'F11':122,'F12':123,
  'NumLock':144,'ScrollLock':145,
  ';':186,'=':187,',':188,'-':189,'.':190,'/':191,'`':192,
  '[':219,'\\':220,']':221,"'":222,
};

// ─── WebRTC config ────────────────────────────────────────────
// TURN credentials can be injected via window.TURN_CONFIG for cross-network support
function buildRTCConfig() {
  const base = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  if (window.TURN_CONFIG && window.TURN_CONFIG.urls) {
    base.push(window.TURN_CONFIG);
  }
  return { iceServers: base };
}
const RTC_CONFIG = buildRTCConfig();

// ─── UI helpers ──────────────────────────────────────────────
const el = id => document.getElementById(id);
function setStatus(text, cls = 'badge-connecting') {
  el('statusBadge').className = `badge ${cls}`;
  el('statusText').textContent = text;
  const dot = el('statusDot');
  dot.className = cls.includes('online') ? 'dot dot-online' : cls.includes('offline') ? 'dot dot-offline' : 'dot dot-connecting';
}

// ─── Signaling WebSocket ──────────────────────────────────────
function connectServer() {
  const url = el('serverUrlInput').value.trim() || 'ws://localhost:3000';
  el('serverStatusText').textContent = 'Menghubungkan…';

  if (ws) { try { ws.close(); } catch {} }

  ws = new WebSocket(url);

  ws.onopen = () => {
    el('serverStatusText').textContent = '✓ Terhubung';
    el('serverStatusText').style.color = 'var(--green)';
    setStatus('Server terhubung', 'badge-online');

    // Register as host with current stored ID if exists
    const savedId = localStorage.getItem('nexlink-host-id') || null;
    ws.send(JSON.stringify({ type: 'host-register', id: savedId }));
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    handleSignal(msg);
  };

  ws.onclose = () => {
    el('serverStatusText').textContent = '✗ Terputus';
    el('serverStatusText').style.color = 'var(--red)';
    setStatus('Server terputus', 'badge-offline');
  };

  ws.onerror = () => {
    el('serverStatusText').textContent = '✗ Error koneksi';
    el('serverStatusText').style.color = 'var(--red)';
  };
}

function reconnectServer() { connectServer(); }

function sig(obj) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(obj));
}

// ─── Signaling handler ────────────────────────────────────────
async function handleSignal(msg) {
  switch (msg.type) {

    case 'host-registered':
      hostId = msg.id;
      hostPw = msg.password;
      localStorage.setItem('nexlink-host-id', hostId);
      el('sessionIdDisplay').textContent = hostId.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
      el('shareIdDisplay').textContent   = hostId.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
      el('sharePwDisplay').textContent   = hostPw;
      // Get local IP
      const ip = API ? await API.getLocalIP() : 'localhost';
      const port = (el('serverUrlInput').value.match(/:(\d+)/) || ['','3000'])[1];
      el('shareServerUrl').textContent   = `ws://${ip}:${port}`;
      break;

    case 'client-joined':
      setStatus('Klien terhubung', 'badge-online');
      el('waitingBadge').style.display = 'none';
      el('streamingPill').style.display = 'inline-flex';
      el('clientLabel').textContent = 'Sesi remote aktif';
      el('hStatClient').textContent = 'online';
      el('hStatClient').style.color = 'var(--green)';
      el('stopBtn').style.display = '';
      sessionStart = Date.now();
      startSessionTimer();
      // Create peer connection and send offer TO client
      await startWebRTC();
      break;

    case 'offer':
      // Client sends offer → we answer
      if (!pc) await setupPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sig({ type: 'answer', sdp: answer });
      break;

    case 'ice':
      if (pc && msg.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
      }
      break;

    case 'client-disconnected':
      setStatus('Menunggu klien…', 'badge-connecting');
      el('waitingBadge').style.display = '';
      el('streamingPill').style.display = 'none';
      el('hStatClient').textContent = 'offline';
      el('hStatClient').style.color = '';
      el('stopBtn').style.display = 'none';
      clearInterval(statsTimer);
      stopPeerConnection();
      break;
  }
}

// ─── WebRTC Setup ─────────────────────────────────────────────
async function setupPeerConnection() {
  if (pc) { pc.close(); }
  pc = new RTCPeerConnection(RTC_CONFIG);

  // Add local screen stream
  if (localStream) {
    for (const track of localStream.getTracks()) pc.addTrack(track, localStream);
  }

  // ICE
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) sig({ type: 'ice', candidate });
  };

  // DataChannel for receiving input from client
  pc.ondatachannel = ({ channel }) => {
    channel.onmessage = (e) => handleRemoteInput(JSON.parse(e.data));
  };

  // Stats polling
  statsTimer = setInterval(async () => {
    if (!pc) return;
    const stats = await pc.getStats();
    stats.forEach(r => {
      if (r.type === 'outbound-rtp' && r.kind === 'video') {
        const fps = r.framesPerSecond || '—';
        el('hStatFPS').textContent = typeof fps === 'number' ? Math.round(fps) : fps;
      }
      if (r.type === 'candidate-pair' && r.state === 'succeeded') {
        const rtt = r.currentRoundTripTime;
        if (rtt !== undefined) el('hStatPing').textContent = Math.round(rtt * 1000) + 'ms';
      }
    });
  }, 1000);
}

async function startWebRTC() {
  await setupPeerConnection();
}

function stopPeerConnection() {
  if (pc) { pc.close(); pc = null; }
  clearInterval(statsTimer);
}

// ─── Input injection from DataChannel ────────────────────────
async function handleRemoteInput(msg) {
  if (!API) return;

  // Remap from client's percentage coords to absolute screen coords
  let absX, absY;
  if (msg.px !== undefined) {
    const sz = await API.getScreenSize();
    absX = Math.round(msg.px * sz.width);
    absY = Math.round(msg.py * sz.height);
  }

  switch (msg.t) {
    case 'mv': API.inputMove(absX, absY); break;
    case 'ld': if (absX) API.inputMove(absX, absY); API.inputLDown(); break;
    case 'lu': API.inputLUp(); break;
    case 'rd': if (absX) API.inputMove(absX, absY); API.inputRDown(); break;
    case 'ru': API.inputRUp(); break;
    case 'md': API.inputMDown(); break;
    case 'mu': API.inputMUp(); break;
    case 'sc': API.inputScroll(msg.d); break;
    case 'kd': { const vk = VK[msg.k] || VK[msg.k?.toLowerCase()]; if (vk) API.inputKDown(vk); break; }
    case 'ku': { const vk = VK[msg.k] || VK[msg.k?.toLowerCase()]; if (vk) API.inputKUp(vk); break; }
  }
}

// ─── Screen sources ───────────────────────────────────────────
async function loadSources() {
  const grid = el('sourceGrid');
  grid.innerHTML = '<div class="text-center text-secondary" style="grid-column:1/-1;padding:32px;"><div class="spinner spinner-lg" style="margin:0 auto 16px;"></div>Memuat…</div>';

  try {
    let sources;
    if (API?.getDesktopSources) {
      sources = await API.getDesktopSources();
    } else {
      // Browser fallback: just show a placeholder
      sources = [{ id: 'screen:0', name: 'Layar Utama', thumbnail: '' }];
    }

    grid.innerHTML = '';
    sources.forEach(src => {
      const card = document.createElement('div');
      card.className = 'source-card';
      card.dataset.id = src.id;
      card.innerHTML = `
        ${src.thumbnail ? `<img src="${src.thumbnail}" alt="${src.name}">` : '<div style="aspect-ratio:16/9;background:#111;display:flex;align-items:center;justify-content:center;font-size:32px;">🖥️</div>'}
        <div class="source-card-label">${src.name}</div>
      `;
      card.onclick = () => {
        document.querySelectorAll('.source-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedSourceId = src.id;
        el('startBtn').disabled = false;
      };
      grid.appendChild(card);
    });

    // Auto-select first
    grid.querySelector('.source-card')?.click();
  } catch (err) {
    grid.innerHTML = `<div class="alert-banner alert-warning" style="grid-column:1/-1;">Gagal memuat sumber layar: ${err.message}</div>`;
  }
}

// ─── Start sharing ────────────────────────────────────────────
async function startSharing() {
  if (!selectedSourceId) return;

  try {
    // Capture selected screen
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: selectedSourceId,
          maxWidth:  1920,
          maxHeight: 1080,
          maxFrameRate: 30,
        },
      },
    });
  } catch (err) {
    // Fallback for browser (non-Electron): use getDisplayMedia
    try {
      localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch (e2) {
      alert('Gagal capture layar: ' + (err.message || e2.message));
      return;
    }
  }

  // Start input helper
  API?.inputStart?.();

  // Switch to session view
  el('stepPicker').classList.add('hidden');
  el('stepSession').classList.remove('hidden');
  setStatus('Menunggu klien…', 'badge-connecting');
  el('stopBtn').style.display = '';
}

// ─── Stop session ─────────────────────────────────────────────
function stopSession() {
  stopPeerConnection();
  localStream?.getTracks().forEach(t => t.stop());
  localStream = null;
  API?.inputStop?.();
  clearInterval(timeTimer);
  sig({ type: 'stop' });

  el('stepSession').classList.add('hidden');
  el('stepPicker').classList.remove('hidden');
  el('streamingPill').style.display = 'none';
  el('waitingBadge').style.display = '';
  el('stopBtn').style.display = 'none';
  el('hStatClient').textContent = 'offline';
  setStatus('Session dihentikan', 'badge-offline');
}

// ─── Session timer ────────────────────────────────────────────
function startSessionTimer() {
  clearInterval(timeTimer);
  timeTimer = setInterval(() => {
    if (!sessionStart) return;
    const s = Math.floor((Date.now() - sessionStart) / 1000);
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    el('hStatTime').textContent = `${mm}:${ss}`;
  }, 1000);
}

// ─── Copy share info ─────────────────────────────────────────
function copyShareInfo() {
  const info = `NexLink Host Info\nServer: ${el('shareServerUrl').textContent}\nID: ${el('shareIdDisplay').textContent}\nPassword: ${el('sharePwDisplay').textContent}`;
  navigator.clipboard.writeText(info);
  const btn = document.querySelector('[onclick="copyShareInfo()"]');
  if (btn) { btn.textContent = '✓ Tersalin!'; setTimeout(() => btn.textContent = '📋 Copy Info Koneksi', 2000); }
}

function goBack() {
  stopSession();
  if (window.electronAPI?.navigate) window.electronAPI.navigate('host');
  else window.location.href = 'host.html';
}

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSources();
  connectServer();
});
