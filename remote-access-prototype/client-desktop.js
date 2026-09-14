// ============================================================
// client-desktop.js — NexLink Desktop Client Logic
// ============================================================
const { startStatsTicker } = window.NexLink;

// ─── Parse URL params ────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const remoteID   = urlParams.get('id')   || '487 293 156';
const remoteName = urlParams.get('name') || 'Remote PC';

document.getElementById('toolbarConnectedID').textContent = remoteID;
document.getElementById('sbHostName').textContent = remoteName;
document.getElementById('confirmTarget').textContent = remoteName;

// ─── Toolbar Show/Hide ───────────────────────────────────────
const toolbar = document.getElementById('clientToolbar');
const trigger = document.getElementById('toolbarTrigger');
let toolbarTimeout;

function showToolbar() {
  clearTimeout(toolbarTimeout);
  toolbar.classList.add('visible');
  trigger.style.height = '0px';
}

function hideToolbar() {
  toolbarTimeout = setTimeout(() => {
    toolbar.classList.remove('visible');
    trigger.style.height = '8px';
  }, 800);
}

trigger.addEventListener('mouseenter', showToolbar);
trigger.addEventListener('mouseleave', () => {
  if (!toolbar.matches(':hover')) hideToolbar();
});

// Show toolbar briefly on load
setTimeout(showToolbar, 500);
setTimeout(hideToolbar, 3000);

// ─── Custom Cursor ───────────────────────────────────────────
const cursor    = document.getElementById('remoteCursor');
const wrapper   = document.getElementById('screenWrapper');
let curX = 200, curY = 200;
let animFrame;

function moveCursor(e) {
  const rect = wrapper.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Smooth cursor movement
  cancelAnimationFrame(animFrame);
  animFrame = requestAnimationFrame(() => {
    curX += (x - curX) * 0.35;
    curY += (y - curY) * 0.35;
    cursor.style.left = curX + 'px';
    cursor.style.top  = curY + 'px';
  });
}

// Initialize cursor position
cursor.style.left = '50%';
cursor.style.top  = '40%';

// ─── Click Events ────────────────────────────────────────────
function clickEvent(e) {
  createRipple(e.clientX, e.clientY, 'click-ripple');
}

function rightClick(e) {
  e.preventDefault();
  createRipple(e.clientX, e.clientY, 'click-ripple', true);
}

function createRipple(x, y, cls, isRight = false) {
  const ripple = document.createElement('div');
  ripple.className = cls;
  if (isRight) ripple.style.borderColor = 'rgba(255,149,0,0.8)';
  ripple.style.left = x + 'px';
  ripple.style.top  = y + 'px';
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 500);
}

// ─── Monitor Switching ───────────────────────────────────────
function switchMonitor(num) {
  const btn1 = document.getElementById('mon1Btn');
  const btn2 = document.getElementById('mon2Btn');
  btn1.classList.toggle('active', num === 1);
  btn2.classList.toggle('active', num === 2);

  // Simulate monitor switch with flash
  const desktop = document.getElementById('winDesktop');
  desktop.style.transition = 'opacity 0.15s';
  desktop.style.opacity = '0';
  setTimeout(() => {
    if (num === 2) {
      desktop.style.background = 'linear-gradient(135deg, #1a3a2e 0%, #0a2a1a 100%)';
    } else {
      desktop.style.background = 'linear-gradient(135deg, #0d1b5e 0%, #1a0a4e 50%, #0a1a3a 100%)';
    }
    desktop.style.opacity = '1';
  }, 150);

  showShortcutToast(`Monitor ${num} ${num === 1 ? '(Primary)' : '(Secondary)'}`);
}

// ─── Display Mode ────────────────────────────────────────────
function changeDisplayMode(mode) {
  const desktop = document.getElementById('winDesktop');
  switch (mode) {
    case 'fit':      desktop.style.objectFit = 'contain'; break;
    case 'original': desktop.style.objectFit = 'none';    break;
    case 'stretched':desktop.style.objectFit = 'fill';    break;
  }
  showShortcutToast(`Display: ${mode === 'fit' ? 'Fit Screen' : mode === 'original' ? '1:1 Original' : 'Stretched'}`);
}

// ─── Quick Actions ───────────────────────────────────────────
function sendCtrlAltDel() {
  showShortcutToast('Sent: Ctrl + Alt + Del');
}

let audioEnabled = true;
function toggleAudio(btn) {
  audioEnabled = !audioEnabled;
  btn.textContent = audioEnabled ? '🔊' : '🔇';
  btn.style.color = audioEnabled ? '' : 'var(--orange)';
  showShortcutToast(audioEnabled ? 'Audio: On' : 'Audio: Muted');
}

function takeScreenshot() {
  showShortcutToast('📸 Screenshot saved!');
  // Flash effect
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.15);z-index:999;pointer-events:none;animation:fade-out 0.3s ease forwards';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 350);
}

let isFullscreen = false;
function toggleFullscreen() {
  isFullscreen = !isFullscreen;
  const btn = document.getElementById('fsBtn');
  if (isFullscreen) {
    document.documentElement.requestFullscreen?.();
    btn.textContent = '⊠';
    btn.setAttribute('data-tooltip', 'Exit Fullscreen');
  } else {
    document.exitFullscreen?.();
    btn.textContent = '⛶';
    btn.setAttribute('data-tooltip', 'Fullscreen');
  }
}

// ─── Disconnect ───────────────────────────────────────────────
function showDisconnect() {
  document.getElementById('disconnectOverlay').classList.remove('hidden');
}
function hideDisconnect() {
  document.getElementById('disconnectOverlay').classList.add('hidden');
}
function doDisconnect() {
  window.location.href = 'index.html';
}

// ─── Shortcut Toast ───────────────────────────────────────────
let toastTimeout;
function showShortcutToast(msg) {
  const toast = document.getElementById('shortcutToast');
  toast.textContent = '⌨ ' + msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2500);
}

// ─── Keyboard Shortcuts ───────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.altKey) {
    if (e.key === 'd' || e.key === 'D') { e.preventDefault(); showDisconnect(); }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
    if (e.key === 'Delete') { e.preventDefault(); sendCtrlAltDel(); }
    if (e.key === '1') { e.preventDefault(); switchMonitor(1); }
    if (e.key === '2') { e.preventDefault(); switchMonitor(2); }
  }
  if (e.key === 'Escape') hideDisconnect();
});

// ─── Window Dragging ─────────────────────────────────────────
let isDragging = false;
let dragWin, dragOffX, dragOffY;

function startDrag(e, winId) {
  isDragging = true;
  dragWin = document.getElementById(winId);
  const rect = dragWin.getBoundingClientRect();
  dragOffX = e.clientX - rect.left;
  dragOffY = e.clientY - rect.top;
  dragWin.style.transition = 'none';
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
}

function onDrag(e) {
  if (!isDragging || !dragWin) return;
  const parent = dragWin.parentElement.getBoundingClientRect();
  const x = Math.max(0, Math.min(e.clientX - parent.left - dragOffX, parent.width - dragWin.offsetWidth));
  const y = Math.max(0, Math.min(e.clientY - parent.top - dragOffY, parent.height - dragWin.offsetHeight));
  dragWin.style.left = x + 'px';
  dragWin.style.top  = y + 'px';
}

function stopDrag() {
  isDragging = false;
  if (dragWin) { dragWin.style.transition = ''; dragWin = null; }
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

function closeWindow(winId) {
  const win = document.getElementById(winId);
  win.style.transition = 'opacity 0.2s, transform 0.2s';
  win.style.opacity = '0';
  win.style.transform = 'scale(0.93)';
  setTimeout(() => win.style.display = 'none', 200);
}

function openExplorer() {
  showShortcutToast('Opening File Explorer...');
}
function openBrowser() {
  showShortcutToast('Opening Chrome...');
}

// ─── Live Stats ───────────────────────────────────────────────
startStatsTicker(({ fps, latency, bitrate }) => {
  // Toolbar
  const el = id => document.getElementById(id);
  if (el('tbFPS'))     el('tbFPS').textContent     = fps;
  if (el('tbPing'))    el('tbPing').textContent     = latency;
  if (el('tbBitrate')) el('tbBitrate').textContent  = bitrate;

  // Status bar
  const fpsEl = el('sbFPS');
  const pinEl = el('sbPing');
  const bitEl = el('sbBitrate');
  if (fpsEl) { fpsEl.textContent = fps; fpsEl.className = fps >= 50 ? 'val good' : 'val warn'; }
  if (pinEl) { pinEl.textContent = latency + 'ms'; pinEl.className = latency <= 30 ? 'val good' : 'val warn'; }
  if (bitEl) { bitEl.textContent = bitrate + ' Mbps'; }
});

// ─── Taskbar Clock ────────────────────────────────────────────
function updateTaskbarClock() {
  const el = document.getElementById('taskbarClock');
  if (!el) return;
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const d = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  el.innerHTML = `<div>${h}:${m}</div><div style="font-size:9px;color:rgba(255,255,255,0.3);">${d}</div>`;
}
updateTaskbarClock();
setInterval(updateTaskbarClock, 10000);

// ─── Desktop icon selection ───────────────────────────────────
document.querySelectorAll('.win-icon').forEach(icon => {
  icon.addEventListener('click', function(e) {
    e.stopPropagation();
    document.querySelectorAll('.win-icon').forEach(i => i.classList.remove('selected'));
    this.classList.add('selected');
  });
});
document.getElementById('winDesktop')?.addEventListener('click', () => {
  document.querySelectorAll('.win-icon').forEach(i => i.classList.remove('selected'));
});

// ─── Real WebRTC Connection ────────────────────────────────────

// Auto-fill server URL if opened via ngrok or public URL
document.addEventListener('DOMContentLoaded', function() {
  const serverInput = document.getElementById('rtcServerUrl');
  if (serverInput && window.NEXLINK_DEFAULT_SERVER) {
    serverInput.value = window.NEXLINK_DEFAULT_SERVER;
    serverInput.style.color = 'var(--green)';
  }
});

function rtcConnect() {
  const serverUrl = document.getElementById('rtcServerUrl').value.trim();
  const hostId = document.getElementById('rtcHostId').value.trim().replace(/\s/g, '');
  const password = document.getElementById('rtcPassword').value.trim();
  const errorEl = document.getElementById('rtcError');

  if (!serverUrl || !hostId || !password) {
    errorEl.textContent = 'Semua field harus diisi';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');
  const btn = document.getElementById('rtcConnectBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:8px;"></span> Menghubungkan...';

  window.NexLinkRTC.connectRTC({
    serverUrl,
    hostId,
    password,
    onStatus: (status, msg) => {
      console.log(`[RTC] Status: ${status} - ${msg}`);
      if (status === 'connected') {
        document.getElementById('rtcOverlay').style.display = 'none';
        document.getElementById('winDesktop').style.display = 'none'; // hide fake desktop
        const video = document.getElementById('remoteVideo');
        video.style.display = 'block';
        window.NexLinkRTC.attachVideoInputListeners(video);
        window.NexLinkRTC.attachKeyboardListeners();
        showShortcutToast('Terhubung ke Host');
      } else if (status === 'disconnected') {
        showDisconnect();
      }
    },
    onStream: (stream) => {
      const video = document.getElementById('remoteVideo');
      video.srcObject = stream;
    },
    onStats: (stats) => {
      if (stats.fps !== null) {
        const fpsEl1 = document.getElementById('tbFPS');
        const fpsEl2 = document.getElementById('sbFPS');
        if (fpsEl1) fpsEl1.textContent = stats.fps;
        if (fpsEl2) fpsEl2.textContent = stats.fps;
      }
      if (stats.latency !== null) {
        const pingEl1 = document.getElementById('tbPing');
        const pingEl2 = document.getElementById('sbPing');
        if (pingEl1) pingEl1.textContent = stats.latency;
        if (pingEl2) pingEl2.textContent = stats.latency + 'ms';
      }
    },
    onError: (err) => {
      errorEl.textContent = 'Error: ' + err;
      errorEl.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = '🔗 Connect';
    }
  });
}

function skipRTC() {
  document.getElementById('rtcOverlay').style.display = 'none';
  showShortcutToast('Demo Mode Aktif');
}
