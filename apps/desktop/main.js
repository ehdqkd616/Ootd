import { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } from 'electron/main';
import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── 단일 인스턴스 ─────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// ─── PNG 아이콘 생성 (외부 파일 불필요) ────────────────────────────────────────
function crc32(buf) {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  let v = 0xFFFFFFFF;
  for (const b of buf) v = t[(v ^ b) & 0xFF] ^ (v >>> 8);
  return (v ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const tp  = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tp, data])));
  return Buffer.concat([len, tp, data, crc]);
}

function makeCircleIcon(size, r, g, b) {
  const cx = (size - 1) / 2, cy = (size - 1) / 2, rad = size / 2 - 2;
  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const a = d < rad ? 255 : d < rad + 1.5 ? Math.round(255 * (rad + 1.5 - d) / 1.5) : 0;
      raw.push(r, g, b, a);
    }
  }
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.from(raw))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const ICONS = {
  green:  nativeImage.createFromBuffer(makeCircleIcon(22, 0x22, 0xC5, 0x5E)),
  yellow: nativeImage.createFromBuffer(makeCircleIcon(22, 0xF5, 0x9E, 0x0B)),
  red:    nativeImage.createFromBuffer(makeCircleIcon(22, 0xEF, 0x44, 0x44)),
  gray:   nativeImage.createFromBuffer(makeCircleIcon(22, 0x6B, 0x71, 0x80)),
};

const APP_ICON = nativeImage.createFromBuffer(makeCircleIcon(256, 0x22, 0xC5, 0x5E));

// ─── 서비스 정의 ───────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..', '..');

const SERVICES = [
  { id: 'auth',     name: 'Auth 서비스',     port: 3001, cwd: path.join(ROOT, 'services', 'auth')    },
  { id: 'wardrobe', name: 'Wardrobe 서비스', port: 3002, cwd: path.join(ROOT, 'services', 'wardrobe') },
  { id: 'outfit',   name: 'Outfit 서비스',   port: 3003, cwd: path.join(ROOT, 'services', 'outfit')  },
  { id: 'web',      name: 'Web (Frontend)',  port: 5173, cwd: path.join(ROOT, 'apps',     'web')     },
];

// ─── 상태 관리 ─────────────────────────────────────────────────────────────────
const procs     = {};
const statuses  = {};
const logBuffer = [];
const MAX_LOGS  = 2000;

for (const s of SERVICES) statuses[s.id] = { state: 'stopped', pid: null };

let mainWindow  = null;
let tray        = null;
let healthTimer = null;

// ─── 포트 체크 ─────────────────────────────────────────────────────────────────
function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: '127.0.0.1' });
    sock.setTimeout(1500);
    sock.on('connect', () => { sock.destroy(); resolve(true);  });
    sock.on('error',   () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

// ─── 로그 추가 ─────────────────────────────────────────────────────────────────
function addLog(serviceId, text, isError = false) {
  const t = text.trim();
  if (!t) return;
  const entry = { time: Date.now(), serviceId, text: t, isError };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
  mainWindow?.webContents.send('log', entry);
}

// ─── 상태 업데이트 ─────────────────────────────────────────────────────────────
function setStatus(id, state, pid = null) {
  statuses[id] = { state, pid };
  mainWindow?.webContents.send('status', { id, state, pid });
  rebuildTrayMenu();
  updateTrayIcon();
}

// ─── 서비스 시작/종료 ──────────────────────────────────────────────────────────
function startService(service) {
  if (procs[service.id]) return;

  setStatus(service.id, 'starting');
  addLog(service.id, `▶ ${service.name} 시작 중... (포트 ${service.port})`);

  const proc = spawn('pnpm', ['dev'], {
    cwd:         service.cwd,
    shell:       true,
    windowsHide: true,
    env:         { ...process.env },
  });

  procs[service.id] = proc;

  proc.stdout.on('data', (d) =>
    d.toString().split('\n').forEach((line) => addLog(service.id, line, false))
  );
  proc.stderr.on('data', (d) =>
    d.toString().split('\n').forEach((line) => addLog(service.id, line, true))
  );
  proc.on('exit', (code) => {
    delete procs[service.id];
    setStatus(service.id, 'stopped');
    addLog(service.id, `■ 프로세스 종료 (코드: ${code ?? '?'})`, code !== 0 && code !== null);
  });
  proc.on('error', (err) => {
    delete procs[service.id];
    setStatus(service.id, 'error');
    addLog(service.id, `오류: ${err.message}`, true);
  });
}

function stopService(service) {
  const proc = procs[service.id];
  if (!proc) return;
  addLog(service.id, `■ ${service.name} 중지 중...`);
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', proc.pid, '/f', '/t'], { shell: true });
  } else {
    proc.kill('SIGTERM');
  }
  delete procs[service.id];
  setStatus(service.id, 'stopped');
}

function startAll() { SERVICES.forEach(startService); }
function stopAll()  { SERVICES.forEach(stopService);  }

// ─── 헬스체크 루프 ─────────────────────────────────────────────────────────────
async function runHealthChecks() {
  for (const s of SERVICES) {
    if (!procs[s.id]) continue;
    const open = await isPortOpen(s.port);
    const cur  = statuses[s.id].state;
    if (open && cur !== 'running') {
      setStatus(s.id, 'running', procs[s.id]?.pid);
      addLog(s.id, `✓ ${s.name} 정상 동작 중 (포트 ${s.port})`);
    } else if (!open && cur === 'running') {
      setStatus(s.id, 'starting', procs[s.id]?.pid);
    }
  }
}

// ─── 트레이 아이콘 ─────────────────────────────────────────────────────────────
function updateTrayIcon() {
  if (!tray) return;
  const vals    = Object.values(statuses).map((s) => s.state);
  const running = vals.filter((v) => v === 'running').length;
  const starting = vals.filter((v) => v === 'starting').length;
  let icon = ICONS.red;
  if (running === SERVICES.length) icon = ICONS.green;
  else if (running > 0 || starting > 0) icon = ICONS.yellow;
  tray.setImage(icon);

  const lines = SERVICES.map((s) => {
    const st  = statuses[s.id].state;
    const dot = st === 'running' ? '●' : st === 'starting' ? '◑' : '○';
    return `${dot} ${s.name}`;
  });
  tray.setToolTip(`OOTD 서비스 매니저\n${lines.join('\n')}`);
}

function rebuildTrayMenu() {
  if (!tray) return;
  const serviceItems = SERVICES.map((s) => {
    const st  = statuses[s.id].state;
    const dot = st === 'running' ? '● ' : st === 'starting' ? '◑ ' : '○ ';
    return {
      label:   `${dot}${s.name}  (${st})`,
      enabled: true,
      click:   () => {
        if (procs[s.id]) stopService(s); else startService(s);
        rebuildTrayMenu();
      },
    };
  });

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'OOTD 서비스 매니저', enabled: false },
    { type: 'separator' },
    ...serviceItems,
    { type: 'separator' },
    { label: '▶ 전체 시작', click: startAll },
    { label: '■ 전체 중지', click: stopAll  },
    { type: 'separator' },
    { label: '창 열기',       click: showWindow },
    { label: '브라우저 열기', click: () => shell.openExternal('http://localhost:5173') },
    { type: 'separator' },
    { label: '종료', click: () => { stopAll(); app.quit(); } },
  ]));
}

// ─── 메인 윈도우 ───────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1100,
    height:          700,
    minWidth:        800,
    minHeight:       500,
    icon:            APP_ICON,
    title:           'OOTD 서비스 매니저',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'window.html'));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function showWindow() {
  if (!mainWindow) createWindow();
  else { mainWindow.show(); mainWindow.focus(); }
}

// ─── IPC 핸들러 ────────────────────────────────────────────────────────────────
ipcMain.handle('get-initial-state', () => ({
  services: SERVICES.map((s) => ({ id: s.id, name: s.name, port: s.port })),
  statuses: { ...statuses },
  logs:     logBuffer.slice(-500),
}));

ipcMain.on('start-service', (_, id) => { const s = SERVICES.find((x) => x.id === id); if (s) startService(s); });
ipcMain.on('stop-service',  (_, id) => { const s = SERVICES.find((x) => x.id === id); if (s) stopService(s);  });
ipcMain.on('start-all',     ()      => startAll());
ipcMain.on('stop-all',      ()      => stopAll());
ipcMain.on('open-browser',  ()      => shell.openExternal('http://localhost:5173'));

// ─── 앱 초기화 ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  app.setAppUserModelId('com.ootd.manager');

  tray = new Tray(ICONS.gray);
  tray.on('click', showWindow);
  rebuildTrayMenu();
  updateTrayIcon();

  createWindow();

  healthTimer = setInterval(runHealthChecks, 4000);

  app.on('second-instance', showWindow);
  app.on('window-all-closed', () => {});
});

app.on('before-quit', () => {
  app.isQuitting = true;
  clearInterval(healthTimer);
  stopAll();
});

process.on('unhandledRejection', (reason) => console.error('[FATAL]', reason));
