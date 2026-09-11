// ============================================================
// host.js — NexLink Host Dashboard Logic
// ============================================================
const { generatePassword, copyToClipboard, startStatsTicker, formatDuration } = window.NexLink;

// ─── Password Management ─────────────────────────────────────
let pwMode = 'temp';
let currentPassword = 'nx-4Hm8pQ2r';
let pwVisible = true;

function setPwMode(mode, btn) {
  pwMode = mode;
  document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const label = document.getElementById('pwModeLabel');
  if (mode === 'temp') {
    label.textContent = '✓ Password akan berubah otomatis setelah sesi berakhir';
    label.style.color = '';
  } else {
    label.textContent = '⚠ Password permanen tidak berubah — lebih rentan';
    label.style.color = 'var(--orange)';
  }
}

function regeneratePassword() {
  const newPw = generatePassword();
  currentPassword = newPw;
  const el = document.getElementById('pwDisplay');
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = newPw;
    el.style.opacity = '1';
  }, 200);
  el.style.transition = 'opacity 0.2s';
}

function togglePwVisibility(btn) {
  const el = document.getElementById('pwDisplay');
  pwVisible = !pwVisible;
  if (pwVisible) {
    el.textContent = currentPassword;
    btn.textContent = '👁️';
    btn.setAttribute('data-tooltip', 'Sembunyikan');
  } else {
    el.textContent = '••••••••';
    btn.textContent = '🙈';
    btn.setAttribute('data-tooltip', 'Tampilkan');
  }
}

function copyHostID(btn) {
  copyToClipboard('487293156', btn);
}

// ─── ID Refresh ───────────────────────────────────────────────
function refreshID() {
  const el = document.getElementById('hostID');
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = window.NexLink.generateID();
    el.style.opacity = '1';
  }, 300);
  el.style.transition = 'opacity 0.3s';
}

// ─── Session Banner ───────────────────────────────────────────
function disconnectSession() {
  const banner = document.getElementById('activeBanner');
  banner.style.opacity = '0';
  banner.style.transform = 'translateY(-8px)';
  banner.style.transition = 'all 0.3s ease';
  setTimeout(() => banner.style.display = 'none', 300);

  // Add to log
  addLogEntry('danger', 'Sesi diakhiri oleh Host', 'Baru saja · Galaxy S25 Ultra · Durasi: 4m 32s');

  // Update stats
  document.getElementById('statFPS').textContent = '—';
  document.getElementById('statLatency').textContent = '—';
  document.getElementById('statBitrate').textContent = '—';
}

// ─── Log Management ───────────────────────────────────────────
function addLogEntry(type, title, meta) {
  const colors = { success: 'var(--green)', danger: 'var(--red)', info: 'var(--blue)', warning: 'var(--orange)' };
  const log = document.getElementById('logContainer');
  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `
    <div class="log-dot" style="background:${colors[type]};"></div>
    <div>
      <div class="text-sm font-semibold">${title}</div>
      <div class="text-xs text-dim">${meta}</div>
    </div>
  `;
  item.style.opacity = '0';
  log.insertBefore(item, log.firstChild);
  requestAnimationFrame(() => {
    item.style.transition = 'opacity 0.3s';
    item.style.opacity = '1';
  });
}

function clearLog() {
  const log = document.getElementById('logContainer');
  log.innerHTML = '<div class="text-sm text-dim" style="padding:12px 0;text-align:center;">Log kosong</div>';
}

// ─── Whitelist Management ─────────────────────────────────────
let whitelistCount = 3;
function addWhitelistDevice() {
  const name = prompt('Nama perangkat:');
  const id   = prompt('ID Perangkat (9 digit):');
  if (!name || !id) return;
  const container = document.getElementById('whitelistContainer');
  const item = document.createElement('div');
  item.className = 'whitelist-item';
  item.innerHTML = `
    <div class="whitelist-icon" style="background:rgba(255,255,255,0.05);font-size:18px;">💻</div>
    <div style="flex:1;">
      <div class="text-sm font-semibold">${name}</div>
      <div class="text-xs text-dim font-mono">ID: ${id}</div>
    </div>
    <div class="badge badge-offline"><span class="dot dot-offline"></span></div>
    <button class="btn btn-ghost btn-icon" onclick="removeWhitelist(this)" style="font-size:14px;color:var(--text-dim);">✕</button>
  `;
  item.style.opacity = '0';
  container.appendChild(item);
  requestAnimationFrame(() => {
    item.style.transition = 'opacity 0.3s';
    item.style.opacity = '1';
  });
}

function removeWhitelist(btn) {
  const item = btn.closest('.whitelist-item');
  item.style.transition = 'opacity 0.25s, transform 0.25s';
  item.style.opacity = '0';
  item.style.transform = 'translateX(10px)';
  setTimeout(() => item.remove(), 250);
}

// ─── Quality Controls ─────────────────────────────────────────
function updateQualitySetting(type, value) {
  if (type === 'fps') {
    document.getElementById('fpsLabel').textContent = `${value} FPS`;
  } else if (type === 'bitrate') {
    document.getElementById('bitrateLabel').textContent = `${value} Mbps`;
  }
}

function setCodec(codec, btn) {
  btn.closest('.pill-control').querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ─── Sidebar Navigation ───────────────────────────────────────
function showSection(section) {
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
  event.currentTarget.classList.add('active');
  // Smooth scroll to section on mobile
  const sectionMap = {
    dashboard: 'dashboardSection',
    security: 'securitySection',
    quality: 'qualitySection',
  };
  if (sectionMap[section]) {
    const el = document.getElementById(sectionMap[section]);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ─── Live Stats ───────────────────────────────────────────────
let sessionStart = Date.now() - (4 * 60 + 32) * 1000;

startStatsTicker(({ fps, latency, bitrate }) => {
  const elapsed = Date.now() - sessionStart;
  const minutes = Math.floor(elapsed / 60000).toString().padStart(2, '0');
  const seconds = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');

  // Stat cards
  const statUptime = document.getElementById('statUptime');
  const statFPS    = document.getElementById('statFPS');
  const statLat    = document.getElementById('statLatency');
  const statBit    = document.getElementById('statBitrate');

  if (statUptime) statUptime.textContent = `${minutes}:${seconds}`;
  if (statFPS)    statFPS.textContent    = fps;
  if (statLat)    statLat.textContent    = latency;
  if (statBit)    statBit.textContent    = bitrate;

  // Session banner
  const banner = document.getElementById('activeBanner');
  if (banner && banner.style.display !== 'none') {
    const bannerSub = banner.querySelector('.text-sm');
    if (bannerSub) {
      bannerSub.textContent = `Terhubung ${minutes}:${seconds}  ·  ${latency} ms latency  ·  ${fps} FPS`;
    }
  }
});

// ─── Clock ───────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  // Nothing in host page to update for clock, but keeping consistent
}
setInterval(updateClock, 10000);
