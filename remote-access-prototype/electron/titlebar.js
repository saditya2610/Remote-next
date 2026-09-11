// ============================================================
// electron/titlebar.js — Inject custom titlebar into all pages
// ============================================================

(function () {
  // Only inject in Electron environment
  if (!window.electronAPI) return;

  document.body.classList.add('is-electron');

  // Build titlebar HTML
  const titlebarHTML = `
    <div class="electron-titlebar" id="electronTitlebar">
      <div class="tb-left">
        <div class="tb-logo-icon">⚡</div>
        <span class="tb-title" id="tbPageTitle">NexLink</span>
      </div>
      <div class="tb-controls">
        <button class="tb-btn" onclick="window.electronAPI.minimize()" title="Minimize">—</button>
        <button class="tb-btn" onclick="window.electronAPI.maximize()" title="Maximize / Restore" id="tbMaxBtn">⛶</button>
        <button class="tb-btn tb-btn-close" onclick="window.electronAPI.close()" title="Close">✕</button>
      </div>
    </div>
  `;

  // Insert titlebar CSS link
  const cssLink = document.createElement('link');
  cssLink.rel  = 'stylesheet';
  cssLink.href = 'electron/titlebar.css';
  document.head.appendChild(cssLink);

  // Insert titlebar as first child of body
  const div = document.createElement('div');
  div.innerHTML = titlebarHTML;
  document.body.insertBefore(div.firstElementChild, document.body.firstChild);

  // Set page title based on current file
  const page = location.pathname.split('/').pop();
  const titles = {
    'index.html':          'NexLink — Home',
    'host.html':           'NexLink — Host Dashboard',
    'client-desktop.html': 'NexLink — Desktop Client',
    'client-mobile.html':  'NexLink — Mobile View',
  };
  const titleEl = document.getElementById('tbPageTitle');
  if (titleEl) titleEl.textContent = titles[page] || 'NexLink';

  // Version display
  window.electronAPI.getVersion?.().then(v => {
    if (titleEl) titleEl.textContent += `  v${v}`;
  }).catch(() => {});

  // Update maximize button icon
  window.addEventListener('resize', () => {
    const btn = document.getElementById('tbMaxBtn');
    if (!btn) return;
    // Can't directly check isMaximized from renderer, use size heuristic
    const isMax = window.outerWidth >= screen.availWidth && window.outerHeight >= screen.availHeight;
    btn.textContent = isMax ? '❐' : '⛶';
  });
})();
