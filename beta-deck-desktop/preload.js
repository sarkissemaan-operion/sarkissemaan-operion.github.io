const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('betaDeckNative', {
  // ---- SRT (direct, no relay) ----
  ffmpegCapabilities: () => ipcRenderer.invoke('ffmpeg:capabilities'),
  srtStart: (url) => ipcRenderer.invoke('srt:start', url),
  srtStop: () => ipcRenderer.invoke('srt:stop'),
  srtChunk: (arrayBuffer) => ipcRenderer.send('srt:chunk', arrayBuffer),
  onSrtLog: (cb) => ipcRenderer.on('srt:log', (_e, line) => cb(line)),
  onSrtExit: (cb) => ipcRenderer.on('srt:exit', (_e, info) => cb(info)),

  // ---- native multi-display video out ----
  listDisplays: () => ipcRenderer.invoke('display:list'),
  openOutputDisplay: (displayId) => ipcRenderer.invoke('display:open', displayId),
  closeOutputDisplay: (displayId) => ipcRenderer.invoke('display:close', displayId),
  sendOutputChunk: (displayId, arrayBuffer, mimeType) => ipcRenderer.send('display:chunk', displayId, arrayBuffer, mimeType),

  // ---- DeckLink hardware output (requires a DeckLink-SDK-enabled ffmpeg build) ----
  listDecklinkDevices: () => ipcRenderer.invoke('decklink:list'),
  decklinkStart: (deviceName) => ipcRenderer.invoke('decklink:start', deviceName),
  decklinkStop: () => ipcRenderer.invoke('decklink:stop'),
  decklinkChunk: (arrayBuffer) => ipcRenderer.send('decklink:chunk', arrayBuffer),
  onDecklinkLog: (cb) => ipcRenderer.on('decklink:log', (_e, line) => cb(line)),
  onDecklinkExit: (cb) => ipcRenderer.on('decklink:exit', (_e, info) => cb(info)),

  // ---- used only inside the output-display.html window itself ----
  onOutputChunk: (cb) => ipcRenderer.on('output:chunk', (_e, buf, mimeType) => cb(buf, mimeType))
});
