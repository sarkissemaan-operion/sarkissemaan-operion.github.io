const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

let mainWindow = null;
let srtProc = null;
const outputWindows = new Map(); // displayId -> { win, ready }

// ---------------- ffmpeg resolution ----------------
function resolveFfmpegPath() {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const bundled = app.isPackaged
    ? path.join(process.resourcesPath, exe)
    : path.join(__dirname, 'resources', process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux', exe);
  if (fs.existsSync(bundled)) return bundled;
  return exe; // fall back to PATH — fine for dev/testing, required to be present for a packaged build with no bundled binary
}

function checkFfmpegCapabilities(ffmpegPath) {
  return new Promise((resolve) => {
    execFile(ffmpegPath, ['-hide_banner', '-protocols'], (err, stdout) => {
      if (err) return resolve({ ok: false, error: err.message, srt: false, decklink: false });
      const srt = /^\s*srt\s*$/m.test(stdout) || /\bsrt\b/.test(stdout);
      execFile(ffmpegPath, ['-hide_banner', '-devices'], (err2, stdout2) => {
        const decklink = !err2 && /decklink/i.test(stdout2 || '');
        resolve({ ok: true, srt, decklink, path: ffmpegPath });
      });
    });
  });
}

// ---------------- SRT output (direct, via bundled/system ffmpeg) ----------------
function startSrt(targetUrl) {
  if (srtProc) return { ok: false, error: 'A feed is already running — stop it first.' };
  const ffmpegPath = resolveFfmpegPath();
  const args = [
    '-hide_banner', '-loglevel', 'warning',
    '-fflags', '+genpts',
    '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-b:v', '4M',
    '-c:a', 'aac', '-b:a', '160k',
    '-f', 'mpegts',
    targetUrl
  ];
  try {
    srtProc = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  } catch (e) {
    srtProc = null;
    return { ok: false, error: 'Could not launch ffmpeg: ' + e.message };
  }
  srtProc.stderr.on('data', (d) => {
    if (mainWindow) mainWindow.webContents.send('srt:log', d.toString());
  });
  srtProc.on('exit', (code, signal) => {
    if (mainWindow) mainWindow.webContents.send('srt:exit', { code, signal });
    srtProc = null;
  });
  srtProc.stdin.on('error', () => { /* benign once ffmpeg has exited/stdin closed */ });
  return { ok: true };
}
function feedSrtChunk(buf) {
  if (!srtProc || !srtProc.stdin.writable) return;
  srtProc.stdin.write(buf);
}
function stopSrt() {
  if (!srtProc) return { ok: true };
  try { srtProc.stdin.end(); } catch (e) {}
  setTimeout(() => { if (srtProc) try { srtProc.kill('SIGKILL'); } catch (e) {} }, 2000);
  return { ok: true };
}

// ---------------- DeckLink hardware output (requires a DeckLink-SDK-enabled ffmpeg build) ----------------
let decklinkProc = null;

function listDecklinkDevices() {
  return new Promise((resolve) => {
    execFile(resolveFfmpegPath(), ['-hide_banner', '-f', 'decklink', '-list_devices', '1', '-i', 'dummy'], (err, stdout, stderr) => {
      const text = (stdout || '') + (stderr || '');
      const devices = [];
      text.split('\n').forEach(line => {
        const m = line.match(/\[decklink[^\]]*\]\s*'([^']+)'/);
        if (m) devices.push(m[1]);
      });
      resolve(devices);
    });
  });
}

function startDecklink(deviceName) {
  if (decklinkProc) return { ok: false, error: 'DeckLink output is already running — stop it first.' };
  const ffmpegPath = resolveFfmpegPath();
  const args = [
    '-hide_banner', '-loglevel', 'warning',
    '-fflags', '+genpts',
    '-i', 'pipe:0',
    '-pix_fmt', 'uyvy422',
    '-f', 'decklink',
    deviceName
  ];
  try {
    decklinkProc = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  } catch (e) {
    decklinkProc = null;
    return { ok: false, error: 'Could not launch ffmpeg: ' + e.message };
  }
  decklinkProc.stderr.on('data', (d) => { if (mainWindow) mainWindow.webContents.send('decklink:log', d.toString()); });
  decklinkProc.on('exit', (code, signal) => {
    if (mainWindow) mainWindow.webContents.send('decklink:exit', { code, signal });
    decklinkProc = null;
  });
  decklinkProc.stdin.on('error', () => {});
  return { ok: true };
}
function feedDecklinkChunk(buf) {
  if (!decklinkProc || !decklinkProc.stdin.writable) return;
  decklinkProc.stdin.write(buf);
}
function stopDecklink() {
  if (!decklinkProc) return { ok: true };
  try { decklinkProc.stdin.end(); } catch (e) {}
  setTimeout(() => { if (decklinkProc) try { decklinkProc.kill('SIGKILL'); } catch (e) {} }, 2000);
  return { ok: true };
}

// ---------------- native multi-display video out (no vendor SDK needed) ----------------
function listDisplays() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    label: (d.label || ('Display ' + d.id)) + (d.id === primary.id ? ' (primary)' : ''),
    bounds: d.bounds,
    isPrimary: d.id === primary.id
  }));
}

function openOutputWindow(displayId) {
  const display = screen.getAllDisplays().find(d => d.id === displayId);
  if (!display) return { ok: false, error: 'Unknown display id ' + displayId };
  closeOutputWindow(displayId);
  const win = new BrowserWindow({
    x: display.bounds.x, y: display.bounds.y,
    width: display.bounds.width, height: display.bounds.height,
    frame: false,
    fullscreen: true,
    backgroundColor: '#000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'output-display.html'));
  outputWindows.set(displayId, win);
  win.on('closed', () => outputWindows.delete(displayId));
  return { ok: true };
}
function closeOutputWindow(displayId) {
  const win = outputWindows.get(displayId);
  if (win && !win.isDestroyed()) win.close();
  outputWindows.delete(displayId);
  return { ok: true };
}
function feedOutputChunk(displayId, buf, mimeType) {
  const win = outputWindows.get(displayId);
  if (win && !win.isDestroyed()) {
    win.webContents.send('output:chunk', buf, mimeType);
  }
}

// ---------------- app lifecycle ----------------
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 950,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createMainWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });

// ---------------- IPC ----------------
ipcMain.handle('ffmpeg:capabilities', async () => checkFfmpegCapabilities(resolveFfmpegPath()));
ipcMain.handle('srt:start', (_e, url) => startSrt(url));
ipcMain.handle('srt:stop', () => stopSrt());
ipcMain.on('srt:chunk', (_e, buf) => feedSrtChunk(Buffer.from(buf)));

ipcMain.handle('display:list', () => listDisplays());
ipcMain.handle('display:open', (_e, displayId) => openOutputWindow(displayId));
ipcMain.handle('display:close', (_e, displayId) => closeOutputWindow(displayId));
ipcMain.on('display:chunk', (_e, displayId, buf, mimeType) => feedOutputChunk(displayId, Buffer.from(buf), mimeType));

ipcMain.handle('decklink:list', () => listDecklinkDevices());
ipcMain.handle('decklink:start', (_e, deviceName) => startDecklink(deviceName));
ipcMain.handle('decklink:stop', () => stopDecklink());
ipcMain.on('decklink:chunk', (_e, buf) => feedDecklinkChunk(Buffer.from(buf)));
