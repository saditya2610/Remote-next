// ============================================================
// client-desktop-rtc.js — NexLink Client WebRTC Engine
// Injected into client-desktop.html for real remote access
// ============================================================

// ─── State ───────────────────────────────────────────────────
let ws          = null;
let pc          = null;
let dataChannel = null;
let videoEl     = null;
let screenW     = 1920;  // host screen dimensions (set via DataChannel)
let screenH     = 1080;

// ─── JS key → VK code (same as host side) ────────────────────
const VK = {
  'Backspace':8,'Tab':9,'Enter':13,'Shift':16,'Control':17,'Alt':18,
  'CapsLock':20,'Escape':27,' ':32,'PageUp':33,'PageDown':34,
  'End':35,'Home':36,'ArrowLeft':37,'ArrowUp':38,'ArrowRight':39,'ArrowDown':40,
  'Insert':45,'Delete':46,
  '0':48,'1':49,'2':50,'3':51,'4':52,'5':53,'6':54,'7':55,'8':56,'9':57,
  'a':65,'b':66,'c':67,'d':68,'e':69,'f':70,'g':71,'h':72,'i':73,'j':74,
  'k':75,'l':76,'m':77,'n':78,'o':79,'p':80,'q':81,'r':82,'s':83,'t':84,
  'u':85,'v':86,'w':87,'x':88,'y':89,'z':90,'Meta':91,'ContextMenu':93,
  'F1':112,'F2':113,'F3':114,'F4':115,'F5':116,'F6':117,
  'F7':118,'F8':119,'F9':120,'F10':121,'F11':122,'F12':123,
};

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ─── Send via DataChannel ────────────────────────────────────
function sendInput(obj) {
  if (dataChannel?.readyState === 'open') {
    dataChannel.send(JSON.stringify(obj));
  }
}

function getRelPos(e) {
  if (!videoEl) return null;
  const rect = videoEl.getBoundingClientRect();
  return {
    px: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
    py: Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height)),
  };
}

// ─── Mouse event handlers for video element ───────────────────
function attachVideoInputListeners(el) {
  el.addEventListener('mousemove', (e) => {
    const p = getRelPos(e);
    if (p) sendInput({ t: 'mv', ...p });
  });
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const p = getRelPos(e);
    if (!p) return;
    if (e.button === 0) sendInput({ t: 'ld', ...p });
    else if (e.button === 2) sendInput({ t: 'rd', ...p });
    else if (e.button === 1) sendInput({ t: 'md', ...p });
  });
  el.addEventListener('mouseup', (e) => {
    if (e.button === 0) sendInput({ t: 'lu' });
    else if (e.button === 2) sendInput({ t: 'ru' });
    else if (e.button === 1) sendInput({ t: 'mu' });
  });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -120 : 120;
    sendInput({ t: 'sc', d: delta });
  }, { passive: false });
  el.addEventListener('contextmenu', e => e.preventDefault());
}

// ─── Keyboard ─────────────────────────────────────────────────
function attachKeyboardListeners() {
  document.addEventListener('keydown', (e) => {
    if (!dataChannel || dataChannel.readyState !== 'open') return;
    e.preventDefault();
    sendInput({ t: 'kd', k: e.key });
  });
  document.addEventListener('keyup', (e) => {
    if (!dataChannel || dataChannel.readyState !== 'open') return;
    sendInput({ t: 'ku', k: e.key });
  });
}

// ─── WebRTC peer (Client = Offerer) ──────────────────────────
async function setupClientPeer(sigFn, onStream, onStats) {
  pc = new RTCPeerConnection(RTC_CONFIG);

  // DataChannel for input
  dataChannel = pc.createDataChannel('input', { ordered: true, maxRetransmits: 2 });
  dataChannel.onopen  = () => console.log('[RTC] DataChannel open');
  dataChannel.onclose = () => console.log('[RTC] DataChannel closed');

  // Receive video stream
  pc.ontrack = ({ streams }) => {
    if (streams[0]) onStream(streams[0]);
  };

  // ICE candidates
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) sigFn({ type: 'ice', candidate });
  };

  pc.onconnectionstatechange = () => {
    console.log('[RTC] Connection state:', pc.connectionState);
  };

  // Stats
  let statsInterval = setInterval(async () => {
    if (!pc) { clearInterval(statsInterval); return; }
    const stats = await pc.getStats();
    const s = {};
    stats.forEach(r => {
      if (r.type === 'inbound-rtp' && r.kind === 'video') {
        s.fps = r.framesPerSecond ? Math.round(r.framesPerSecond) : null;
      }
      if (r.type === 'candidate-pair' && r.state === 'succeeded') {
        if (r.currentRoundTripTime !== undefined)
          s.latency = Math.round(r.currentRoundTripTime * 1000);
      }
    });
    if (Object.keys(s).length) onStats(s);
  }, 1000);

  // Create offer
  const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: false });
  await pc.setLocalDescription(offer);
  sigFn({ type: 'offer', sdp: offer });

  return pc;
}

// ─── Signaling ────────────────────────────────────────────────
function connectRTC({ serverUrl, hostId, password, onStatus, onStream, onStats, onError }) {
  onStatus('connecting', 'Menghubungkan ke server…');

  try { ws = new WebSocket(serverUrl); } catch (e) { onError(e.message); return; }

  ws.onopen = () => {
    onStatus('connecting', 'Terhubung ke server, mencari host…');
    ws.send(JSON.stringify({ type: 'client-connect', hostId, password }));
  };

  ws.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    switch (msg.type) {
      case 'host-ready':
        onStatus('connecting', 'Host ditemukan! Negotiating WebRTC…');
        await setupClientPeer(
          (obj) => ws.send(JSON.stringify(obj)),
          onStream,
          onStats
        );
        break;

      case 'answer':
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        onStatus('connected', 'Terhubung!');
        break;

      case 'ice':
        if (pc && msg.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
        }
        break;

      case 'error':
        onError(msg.message || msg.code);
        ws.close();
        break;

      case 'host-disconnected':
        onStatus('disconnected', 'Host memutus koneksi');
        disconnectRTC();
        break;
    }
  };

  ws.onclose = (e) => {
    if (e.code !== 1000) onStatus('disconnected', 'Koneksi terputus');
  };

  ws.onerror = () => onError('Tidak bisa terhubung ke server signaling');
}

function disconnectRTC() {
  if (dataChannel) { dataChannel.close(); dataChannel = null; }
  if (pc) { pc.close(); pc = null; }
  if (ws) { ws.close(); ws = null; }
}

// Export
window.NexLinkRTC = {
  connectRTC,
  disconnectRTC,
  attachVideoInputListeners,
  attachKeyboardListeners,
};
