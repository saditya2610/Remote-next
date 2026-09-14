// ============================================================
// app.js — NexLink Shared Application Logic
// ============================================================

// ─── Simulated Device State ──────────────────────────────────
const AppState = {
  myID: '487 293 156',
  connected: false,
  sessionClient: null,
  sessionStartTime: null,
  quality: { fps: 60, bitrate: 8000, latency: 12 },
};

// ─── Utility Functions ───────────────────────────────────────

/** Format milliseconds as MM:SS */
function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Generate a random 9-digit ID like AnyDesk */
function generateID() {
  const d = () => Math.floor(Math.random() * 900 + 100);
  return `${d()} ${d()} ${d()}`;
}

/** Generate a random 6-char alphanumeric password */
function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** Copy text to clipboard with visual feedback */
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '✓ Copied!';
    btn.style.color = 'var(--green)';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.color = '';
    }, 2000);
  });
}

/** Simulate latency fluctuation */
function simulateLatency() {
  const base = 12;
  return base + Math.floor(Math.random() * 8) - 4;
}

/** Simulate FPS fluctuation */
function simulateFPS() {
  return 55 + Math.floor(Math.random() * 8);
}

/** Animate number counting up */
function animateCount(el, target, duration = 1000) {
  const start = parseInt(el.textContent) || 0;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/** Simulate typing animation on input */
function typeText(input, text, speed = 80) {
  let i = 0;
  input.value = '';
  const interval = setInterval(() => {
    if (i < text.length) {
      input.value += text[i++];
      input.dispatchEvent(new Event('input'));
    } else {
      clearInterval(interval);
    }
  }, speed);
}

/** Format ID with spaces (format: 000 000 000) */
function formatIDInput(input) {
  let val = input.value.replace(/\D/g, '').slice(0, 9);
  let formatted = '';
  for (let i = 0; i < val.length; i++) {
    if (i === 3 || i === 6) formatted += ' ';
    formatted += val[i];
  }
  input.value = formatted;
}

// ─── Connection Simulation ───────────────────────────────────

/** Simulate a connection sequence with stages */
function simulateConnect(onStage, onDone) {
  const stages = [
    { msg: 'Resolving peer address...', delay: 600 },
    { msg: 'Establishing WebRTC channel...', delay: 900 },
    { msg: 'DTLS-SRTP handshake...', delay: 700 },
    { msg: 'Authenticating session...', delay: 500 },
    { msg: 'Negotiating codec (H.264)...', delay: 600 },
    { msg: 'Connected!', delay: 300 },
  ];

  let i = 0;
  function next() {
    if (i < stages.length) {
      onStage(stages[i].msg, i, stages.length);
      setTimeout(() => { i++; next(); }, stages[i - 1]?.delay || 600);
    } else {
      onDone();
    }
  }
  next();
}

// ─── Live Stats Ticker ───────────────────────────────────────
let _statsInterval = null;

function startStatsTicker(callback) {
  if (_statsInterval) clearInterval(_statsInterval);
  _statsInterval = setInterval(() => {
    callback({
      fps: simulateFPS(),
      latency: simulateLatency(),
      bitrate: (7.2 + Math.random() * 1.6).toFixed(1),
      uptime: AppState.sessionStartTime ? Date.now() - AppState.sessionStartTime : 0,
    });
  }, 1000);
}

function stopStatsTicker() {
  if (_statsInterval) { clearInterval(_statsInterval); _statsInterval = null; }
}

// ─── Export (accessible globally) ───────────────────────────
function getMyID() {
  let id = localStorage.getItem('nexlink_my_id');
  if (!id) {
    id = generateID();
    localStorage.setItem('nexlink_my_id', id);
  }
  return id;
}

function getRecentConnections() {
  try { return JSON.parse(localStorage.getItem('nexlink_recent')) || []; } catch(e) { return []; }
}

function addRecentConnection(name, id) {
  let recent = getRecentConnections();
  recent = recent.filter(r => r.id !== id);
  recent.unshift({ name: name || 'Remote PC', id, time: Date.now() });
  if (recent.length > 5) recent = recent.slice(0, 5);
  localStorage.setItem('nexlink_recent', JSON.stringify(recent));
}

window.NexLink = {
  AppState, formatDuration, generateID, generatePassword,
  copyToClipboard, simulateLatency, simulateFPS, animateCount,
  typeText, formatIDInput, simulateConnect, startStatsTicker, stopStatsTicker,
  getMyID, getRecentConnections, addRecentConnection,
};
