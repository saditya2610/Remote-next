// ============================================================
// electron/preload.js — Secure Bridge v2 (contextBridge)
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Window controls ─────────────────────────────────────
  minimize:  () => ipcRenderer.send('window-minimize'),
  maximize:  () => ipcRenderer.send('window-maximize'),
  close:     () => ipcRenderer.send('window-close'),
  navigate:  (page) => ipcRenderer.send('navigate', page),
  getVersion: () => ipcRenderer.invoke('get-version'),
  platform:   process.platform,
  isElectron: true,

  // ── Network ──────────────────────────────────────────────
  getLocalIP:    () => ipcRenderer.invoke('get-local-ip'),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),

  // ── Screen capture (Host side) ───────────────────────────
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),

  // ── Input injection (Host side) ──────────────────────────
  inputStart: ()           => ipcRenderer.send('input-start'),
  inputStop:  ()           => ipcRenderer.send('input-stop'),
  inputMove:  (x, y)      => ipcRenderer.send('input-move',   { x, y }),
  inputLDown: ()           => ipcRenderer.send('input-ldown'),
  inputLUp:   ()           => ipcRenderer.send('input-lup'),
  inputRDown: ()           => ipcRenderer.send('input-rdown'),
  inputRUp:   ()           => ipcRenderer.send('input-rup'),
  inputMDown: ()           => ipcRenderer.send('input-mdown'),
  inputMUp:   ()           => ipcRenderer.send('input-mup'),
  inputScroll:(delta)      => ipcRenderer.send('input-scroll', { delta }),
  inputKDown: (vk)         => ipcRenderer.send('input-kdown',  { vk }),
  inputKUp:   (vk)         => ipcRenderer.send('input-kup',    { vk }),
});
