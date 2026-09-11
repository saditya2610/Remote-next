// ============================================================
// electron/main.js — NexLink Electron Main Process (v2 — Real Remote)
// ============================================================

const {
  app, BrowserWindow, Menu, Tray,
  ipcMain, shell, nativeTheme,
  desktopCapturer, screen
} = require('electron');
const path   = require('path');
const os     = require('os');
const { spawn } = require('child_process');

const isDev   = process.argv.includes('--dev');
const APP_NAME = 'NexLink';
const ICON_PATH = path.join(__dirname, 'icon.ico');

// ─── Window refs ─────────────────────────────────────────────
let mainWindow = null;
let tray       = null;

// ─── Input injection (PowerShell persistent process) ─────────
let inputProcess  = null;
let inputReady    = false;
let inputQueue    = [];

function startInputHelper() {
  if (inputProcess) return;
  const psScript = path.join(__dirname, 'input-helper.ps1');
  inputProcess = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', psScript
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  inputProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('READY')) {
      inputReady = true;
      // Flush queued commands
      for (const cmd of inputQueue) inputProcess.stdin.write(cmd + '\n');
      inputQueue = [];
    }
  });
  inputProcess.stderr.on('data', (d) => {
    if (isDev) console.error('[InputHelper]', d.toString());
  });
  inputProcess.on('exit', () => {
    inputProcess = null;
    inputReady   = false;
  });
}

function sendInput(obj) {
  const line = JSON.stringify(obj);
  if (inputReady && inputProcess) {
    inputProcess.stdin.write(line + '\n');
  } else {
    if (!inputProcess) startInputHelper();
    inputQueue.push(line);
  }
}

function stopInputHelper() {
  if (inputProcess) {
    inputProcess.stdin.end();
    inputProcess.kill();
    inputProcess = null;
    inputReady   = false;
  }
}

// ─── Create Main Window ───────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    minWidth: 900, minHeight: 600,
    title: APP_NAME,
    icon:  ICON_PATH,
    show:  false,
    frame: false,
    backgroundColor: '#070B17',
    webPreferences: {
      nodeIntegration:   false,
      contextIsolation:  true,
      preload:           path.join(__dirname, 'preload.js'),
      webSecurity:       false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  return mainWindow;
}

// ─── Tray ─────────────────────────────────────────────────────
function createTray() {
  try { tray = new Tray(ICON_PATH); } catch { return; }
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'NexLink', enabled: false },
    { type: 'separator' },
    { label: '🏠 Open', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: '❌ Quit', click: () => app.quit() },
  ]));
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ─── IPC — Window Controls ────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('window-close',    () => mainWindow?.close());
ipcMain.on('navigate', (_, page) => {
  const map = { index:'index.html', host:'host.html', 'client-desktop':'client-desktop.html', 'client-mobile':'client-mobile.html', 'host-session':'host-session.html' };
  if (map[page]) mainWindow?.loadFile(path.join(__dirname, '..', map[page]));
});
ipcMain.handle('get-version', () => app.getVersion());

// ─── IPC — Network Info ───────────────────────────────────────
ipcMain.handle('get-local-ip', () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
});

ipcMain.handle('get-screen-size', () => {
  const primary = screen.getPrimaryDisplay();
  return { width: primary.size.width, height: primary.size.height };
});

// ─── IPC — Desktop Capture ───────────────────────────────────
ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 320, height: 180 }
  });
  return sources.map(s => ({
    id:        s.id,
    name:      s.name,
    thumbnail: s.thumbnail.toDataURL(),
  }));
});

// ─── IPC — Input Injection (Host) ────────────────────────────
ipcMain.on('input-start', () => startInputHelper());
ipcMain.on('input-stop',  () => stopInputHelper());

// Mouse move — high frequency, no response needed
ipcMain.on('input-move', (_, { x, y }) => {
  sendInput({ t: 'mv', x: Math.round(x), y: Math.round(y) });
});

// Mouse buttons
ipcMain.on('input-ldown',  () => sendInput({ t: 'ld' }));
ipcMain.on('input-lup',    () => sendInput({ t: 'lu' }));
ipcMain.on('input-rdown',  () => sendInput({ t: 'rd' }));
ipcMain.on('input-rup',    () => sendInput({ t: 'ru' }));
ipcMain.on('input-mdown',  () => sendInput({ t: 'md' }));
ipcMain.on('input-mup',    () => sendInput({ t: 'mu' }));
ipcMain.on('input-scroll', (_, { delta }) => {
  sendInput({ t: 'sc', d: Math.round(delta) });
});

// Keyboard — vk is Windows Virtual Key code (0-255)
ipcMain.on('input-kdown', (_, { vk }) => sendInput({ t: 'kd', v: vk }));
ipcMain.on('input-kup',   (_, { vk }) => sendInput({ t: 'ku', v: vk }));

// ─── App Lifecycle ────────────────────────────────────────────
app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  createMainWindow();
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  stopInputHelper();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => stopInputHelper());

// Security
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && url !== 'about:blank') e.preventDefault();
  });
});
