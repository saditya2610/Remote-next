// ============================================================
// client-mobile.js — NexLink Mobile Client Logic
// ============================================================
const { startStatsTicker } = window.NexLink;

// ─── State ───────────────────────────────────────────────────
let touchMode = 'trackpad'; // 'trackpad' | 'direct'
let zoomScale = 1.0;
let panX = 0, panY = 0;
let isHoldClick = false;
let keyboardVisible = true;

// Modifier key state
const modifiers = { Control: false, Alt: false, Shift: false, Meta: false };

// Touch tracking
let lastTouches = [];
let touchStartX = 0, touchStartY = 0;
let cursorX = 100, cursorY = 100;
let lastTapTime = 0;
let twoFingerScrollStart = null;

const cursor      = document.getElementById('mobileCursor');
const zoomLayer   = document.getElementById('zoomLayer');
const screenArea  = document.getElementById('mobileScreenArea');

// ─── Cursor ──────────────────────────────────────────────────
function setCursor(x, y) {
  const area = screenArea.getBoundingClientRect();
  const relX = Math.max(0, Math.min(x, area.width));
  const relY = Math.max(0, Math.min(y, area.height));
  cursorX = relX;
  cursorY = relY;
  cursor.style.left = relX + 'px';
  cursor.style.top  = relY + 'px';
}

// Initialize cursor center
setTimeout(() => {
  const area = screenArea.getBoundingClientRect();
  setCursor(area.width / 2, area.height / 2);
}, 100);

// ─── Touch Handlers ──────────────────────────────────────────
function handleTouchStart(e) {
  e.preventDefault();
  lastTouches = Array.from(e.touches);
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;

  if (e.touches.length === 2) {
    twoFingerScrollStart = {
      midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      dist: getTouchDistance(e.touches),
    };
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  const touches = Array.from(e.touches);

  if (touches.length === 1 && lastTouches.length === 1) {
    const dx = touches[0].clientX - lastTouches[0].clientX;
    const dy = touches[0].clientY - lastTouches[0].clientY;

    if (touchMode === 'trackpad') {
      // Move cursor relative
      const sensitivity = 1.5;
      setCursor(cursorX + dx * sensitivity, cursorY + dy * sensitivity);
    } else {
      // Direct mode: map touch position to screen
      const area = screenArea.getBoundingClientRect();
      const relX = touches[0].clientX - area.left;
      const relY = touches[0].clientY - area.top;
      setCursor(relX, relY);
    }
  }

  if (touches.length === 2 && twoFingerScrollStart) {
    // Pinch to zoom
    const newDist = getTouchDistance(touches);
    const scaleDelta = newDist / twoFingerScrollStart.dist;
    const newScale = Math.max(0.5, Math.min(3.0, zoomScale * scaleDelta));
    applyZoom(newScale);
    twoFingerScrollStart.dist = newDist;

    // Two-finger scroll
    const midX = (touches[0].clientX + touches[1].clientX) / 2;
    const midY = (touches[0].clientY + touches[1].clientY) / 2;
    const scrollDx = midX - twoFingerScrollStart.midX;
    const scrollDy = midY - twoFingerScrollStart.midY;

    panX = Math.max(-200, Math.min(200, panX + scrollDx * 0.5));
    panY = Math.max(-200, Math.min(200, panY + scrollDy * 0.5));
    applyTransform();

    twoFingerScrollStart.midX = midX;
    twoFingerScrollStart.midY = midY;
  }

  lastTouches = touches;
}

function handleTouchEnd(e) {
  e.preventDefault();
  const now = Date.now();
  const endTouches = Array.from(e.changedTouches);

  // Check for taps
  if (lastTouches.length === 1 && e.touches.length === 0) {
    const dx = endTouches[0].clientX - touchStartX;
    const dy = endTouches[0].clientY - touchStartY;
    const moved = Math.sqrt(dx * dx + dy * dy);

    if (moved < 10) {
      // It's a tap
      const timeSinceLast = now - lastTapTime;
      lastTapTime = now;

      if (touchMode === 'direct') {
        // Direct mode: click where tapped
        const area = screenArea.getBoundingClientRect();
        const x = endTouches[0].clientX - area.left;
        const y = endTouches[0].clientY - area.top;
        setCursor(x, y);
      }
      createTouchRipple(endTouches[0].clientX, endTouches[0].clientY, false);
    }
  }

  if (lastTouches.length === 2 && e.touches.length === 0) {
    // Two-finger tap = right click
    const cx = (endTouches[0]?.clientX + (endTouches[1]?.clientX || endTouches[0].clientX)) / 2;
    const cy = (endTouches[0]?.clientY + (endTouches[1]?.clientY || endTouches[0].clientY)) / 2;
    createTouchRipple(cx, cy, true);
    showModeToastBrief('🖱️', 'Klik Kanan', '', 1200);
  }

  if (e.touches.length === 0) {
    twoFingerScrollStart = null;
    lastTouches = [];
  } else {
    lastTouches = Array.from(e.touches);
  }
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function createTouchRipple(x, y, isRight) {
  const ripple = document.createElement('div');
  ripple.className = 'touch-ripple' + (isRight ? ' touch-ripple-right' : '');
  ripple.style.left = x + 'px';
  ripple.style.top  = y + 'px';
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

// ─── Zoom ─────────────────────────────────────────────────────
function applyZoom(scale) {
  zoomScale = Math.max(0.5, Math.min(3.0, scale));
  applyTransform();
  document.getElementById('zoomLevelLabel').textContent = zoomScale.toFixed(1) + '×';
}

function applyTransform() {
  if (zoomLayer) {
    zoomLayer.style.transform = `scale(${zoomScale}) translate(${panX / zoomScale}px, ${panY / zoomScale}px)`;
  }
}

function zoomIn() {
  applyZoom(zoomScale + 0.25);
}
function zoomOut() {
  if (zoomScale > 1.0) {
    applyZoom(zoomScale - 0.25);
  } else {
    // Reset pan
    panX = 0; panY = 0;
    applyZoom(1.0);
  }
}

// ─── Touch Mode ───────────────────────────────────────────────
function setTouchMode(mode) {
  touchMode = mode;
  document.getElementById('modeTrackpad').classList.toggle('active', mode === 'trackpad');
  document.getElementById('modeDirect').classList.toggle('active', mode === 'direct');

  const indicator = document.getElementById('trackpadIndicator');
  if (indicator) {
    indicator.textContent = mode === 'trackpad' ? 'Trackpad Mode' : 'Direct Touch Mode';
  }

  if (mode === 'trackpad') {
    showModeToast('🖱️', 'Trackpad Mode', 'Geser 1 jari → kursor · Ketuk → klik kiri · 2 jari → klik kanan');
  } else {
    showModeToast('👆', 'Direct Touch', 'Sentuh langsung = klik di posisi itu');
  }
}

// ─── Keyboard Toggle ─────────────────────────────────────────
function toggleKeyboard() {
  keyboardVisible = !keyboardVisible;
  const kbArea = document.querySelector('.mobile-kb-area');
  const btn = document.getElementById('modeKeyboard');
  if (kbArea) {
    kbArea.style.display = keyboardVisible ? '' : 'none';
  }
  btn.classList.toggle('active', keyboardVisible);
}

// ─── Hold Click ───────────────────────────────────────────────
function activateHoldClick(btn) {
  isHoldClick = true;
  btn.classList.add('active');
  showModeToastBrief('🖱️', 'Hold Click Aktif', 'Geser untuk drag & drop', 3000);
}
function deactivateHoldClick(btn) {
  isHoldClick = false;
  btn.classList.remove('active');
}

// ─── Keyboard Keys ────────────────────────────────────────────
function pressKey(key, el) {
  el.classList.add('pressed');
  if (modifiers.hasOwnProperty(key)) {
    modifiers[key] = !modifiers[key];
    if (modifiers[key]) {
      el.classList.add('pressed');
    } else {
      el.classList.remove('pressed');
    }
  }
  showKeyFeedback(key);
}

function releaseKey(el) {
  setTimeout(() => el.classList.remove('pressed'), 150);
}

function releaseModifier(el) {
  // Modifiers stay pressed until released again (toggle)
  // Visual feedback only
}

function pressCombo(combo, el) {
  el.classList.add('pressed');
  showKeyFeedback(combo);
}

function showKeyFeedback(key) {
  // Brief toast for key press
  const keyName = {
    'Control': 'Ctrl', 'Alt': 'Alt', 'Shift': 'Shift', 'Meta': '⊞ Win',
    'Escape': 'Esc', 'Delete': 'Del', 'Backspace': '⌫',
    'ArrowLeft': '←', 'ArrowRight': '→', 'ArrowUp': '↑', 'ArrowDown': '↓',
  }[key] || key;

  // Don't show toast for modifier keys to avoid noise
  if (['Control','Alt','Shift','Meta'].includes(key)) return;

  showModeToastBrief('⌨️', `Sent: ${keyName}`, '', 800);
}

// ─── Mode Toast ───────────────────────────────────────────────
let modeToastTimeout;
function showModeToast(icon, text, sub) {
  const toast = document.getElementById('modeToast');
  document.getElementById('modeToastIcon').textContent = icon;
  document.getElementById('modeToastText').textContent = text;
  document.getElementById('modeToastSub').textContent = sub;

  toast.classList.remove('hidden');
  toast.style.display = 'flex';
  toast.style.flexDirection = 'column';
  toast.style.alignItems = 'center';
  toast.style.opacity = '1';
  toast.style.transform = 'translate(-50%, -50%) scale(1)';

  clearTimeout(modeToastTimeout);
  modeToastTimeout = setTimeout(() => hideModeToast(), 2200);
}

function showModeToastBrief(icon, text, sub, duration = 1200) {
  const toast = document.getElementById('modeToast');
  document.getElementById('modeToastIcon').textContent = icon;
  document.getElementById('modeToastText').textContent = text;
  document.getElementById('modeToastSub').textContent = sub;

  toast.classList.remove('hidden');
  toast.style.opacity = '0.85';
  clearTimeout(modeToastTimeout);
  modeToastTimeout = setTimeout(hideModeToast, duration);
}

function hideModeToast() {
  const toast = document.getElementById('modeToast');
  toast.style.transition = 'opacity 0.3s';
  toast.style.opacity = '0';
  setTimeout(() => toast.classList.add('hidden'), 300);
}

// ─── Mobile Disconnect ────────────────────────────────────────
function showMobileDisconnect() {
  const overlay = document.getElementById('mobileDisconnectOverlay');
  overlay.style.display = 'flex';
  overlay.style.opacity = '1';
}
function hideMobileDisconnect() {
  document.getElementById('mobileDisconnectOverlay').style.display = 'none';
}

// ─── Audio Toggle ─────────────────────────────────────────────
function toggleMobileAudio(btn) {
  const muted = btn.textContent === '🔇';
  btn.textContent = muted ? '🔊' : '🔇';
  showModeToastBrief(muted ? '🔊' : '🔇', muted ? 'Audio On' : 'Audio Muted', '', 1000);
}

// ─── Live Stats ───────────────────────────────────────────────
startStatsTicker(({ fps, latency }) => {
  const fpsel  = document.getElementById('mStatFPS');
  const pingel = document.getElementById('mStatPing');
  if (fpsel)  fpsel.textContent  = fps;
  if (pingel) { pingel.textContent = latency; pingel.className = latency <= 30 ? 'sv' : 'sv warn'; }
});

// ─── Taskbar Clock ────────────────────────────────────────────
function updateMobileClock() {
  const el = document.getElementById('mobileTaskbarClock');
  if (!el) return;
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  el.innerHTML = `<div>${h}:${m}</div><div>${now.getDate()}/${now.getMonth()+1}</div>`;
}
updateMobileClock();
setInterval(updateMobileClock, 30000);

// ─── Network Detection (simulate) ────────────────────────────
function simulateNetworkType() {
  // In a real app: navigator.connection.effectiveType
  const types = ['WiFi', '4G', '4G', '5G', 'WiFi'];
  const type = types[Math.floor(Math.random() * types.length)];
  const chip = document.getElementById('networkChip');
  if (chip) {
    chip.innerHTML = `${type} <span class="sv">${type === 'WiFi' || type === '5G' ? 'Excellent' : 'Good'}</span>`;
  }
}
simulateNetworkType();

// ─── Init ─────────────────────────────────────────────────────
// Show welcome mode toast
setTimeout(() => {
  showModeToast('🖱️', 'Trackpad Mode', 'Geser 1 jari → kursor · Ketuk → klik kiri');
}, 600);
