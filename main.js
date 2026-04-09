const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

// Use dedicated userData dir to avoid GPU cache conflicts
app.setPath('userData', path.join(process.env.APPDATA, 'STS2ModManager', 'electron'));

let mainWindow;
let gamePath = null;
const DISABLED_DIR = 'mods_disabled';
const LEGACY_DISABLED_DIR = '_disabled';

// ── Config persistence ──
const CONFIG_PATH = path.join(process.env.APPDATA, 'STS2ModManager', 'config.json');
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (e) {}
  return {};
}
function saveConfig(cfg) {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// ── Window controls ──
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

// ── Auto-detect game path ──
function detectGamePath() {
  const steamPaths = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'D:\\SteamLibrary',
    'E:\\SteamLibrary',
  ];

  // Check libraryfolders.vdf
  for (const sp of steamPaths) {
    const vdfPath = path.join(sp, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(vdfPath)) {
      try {
        const content = fs.readFileSync(vdfPath, 'utf-8');
        const pathMatches = content.match(/"path"\s+"([^"]+)"/g);
        if (pathMatches) {
          for (const m of pathMatches) {
            const libPath = m.match(/"path"\s+"([^"]+)"/)[1].replace(/\\\\/g, '\\');
            const gameDir = path.join(libPath, 'steamapps', 'common', 'Slay the Spire 2');
            if (fs.existsSync(gameDir)) return gameDir;
          }
        }
      } catch (e) {}
    }
    // Direct check
    const gameDir = path.join(sp, 'steamapps', 'common', 'Slay the Spire 2');
    if (fs.existsSync(gameDir)) return gameDir;
  }

  // Hardcoded common paths
  const directPaths = [
    'D:\\SteamLibrary\\steamapps\\common\\Slay the Spire 2',
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Slay the Spire 2',
  ];
  for (const p of directPaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── Get mods directory ──
function getModsDir() {
  if (!gamePath) return null;
  return path.join(gamePath, 'mods');
}

function getDisabledDir() {
  if (!gamePath) return null;
  const dir = path.join(gamePath, DISABLED_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getLegacyDisabledDir() {
  const modsDir = getModsDir();
  if (!modsDir) return null;
  return path.join(modsDir, LEGACY_DISABLED_DIR);
}

function migrateLegacyDisabledDir() {
  const legacyDir = getLegacyDisabledDir();
  const disabledDir = getDisabledDir();
  if (!legacyDir || !disabledDir || !fs.existsSync(legacyDir)) return;

  const items = fs.readdirSync(legacyDir);
  for (const item of items) {
    const src = path.join(legacyDir, item);
    const dst = path.join(disabledDir, item);
    if (!fs.existsSync(dst)) {
      fs.renameSync(src, dst);
    }
  }

  if (fs.existsSync(legacyDir) && fs.readdirSync(legacyDir).length === 0) {
    fs.rmdirSync(legacyDir);
  }
}

function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  return JSON.parse(content);
}

// ── Scan mods ──
function scanMods() {
  const modsDir = getModsDir();
  if (!modsDir || !fs.existsSync(modsDir)) return [];

  migrateLegacyDisabledDir();

  const mods = [];

  // Scan enabled mods
  const items = fs.readdirSync(modsDir);
  for (const item of items) {
    if (item === LEGACY_DISABLED_DIR) continue;
    const fullPath = path.join(modsDir, item);
    const mod = tryParseMod(fullPath, item, true);
    if (mod) mods.push(mod);
  }

  // Scan disabled mods
  const disabledDir = getDisabledDir();
  if (fs.existsSync(disabledDir)) {
    const disabledItems = fs.readdirSync(disabledDir);
    for (const item of disabledItems) {
      const fullPath = path.join(disabledDir, item);
      const mod = tryParseMod(fullPath, item, false);
      if (mod) mods.push(mod);
    }
  }

  mods.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return (a.name || a.id || '').localeCompare(b.name || b.id || '', 'zh-CN', { sensitivity: 'base' });
  });

  return mods;
}

function tryParseMod(fullPath, itemName, enabled) {
  const stat = fs.statSync(fullPath);

  if (stat.isDirectory()) {
    // Folder mod - look for JSON manifest inside
    const jsonFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.json'));
    for (const jf of jsonFiles) {
      try {
        const data = readJsonFile(path.join(fullPath, jf));
        if (data.id && data.name) {
          return {
            ...data,
            enabled,
            instanceKey: fullPath,
            folderName: itemName,
            isFolder: true,
            path: fullPath,
            files: fs.readdirSync(fullPath),
            size: getDirSize(fullPath),
          };
        }
      } catch (e) {}
    }
  } else if (itemName.endsWith('.json') && !itemName.startsWith('.')) {
    // Flat mod - JSON manifest at root
    try {
      const data = readJsonFile(fullPath);
      if (data.id && data.name) {
        const baseName = itemName.replace('.json', '');
        const modsDir = path.dirname(fullPath);
        const relatedFiles = fs.readdirSync(modsDir).filter(
          f => f.startsWith(baseName + '.') && f !== itemName
        );
        let totalSize = stat.size;
        for (const rf of relatedFiles) {
          try { totalSize += fs.statSync(path.join(modsDir, rf)).size; } catch (e) {}
        }
        return {
          ...data,
          enabled,
          instanceKey: fullPath,
          folderName: baseName,
          isFolder: false,
          path: modsDir,
          files: [itemName, ...relatedFiles],
          size: totalSize,
        };
      }
    } catch (e) {}
  }
  return null;
}

function getDirSize(dir) {
  let size = 0;
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      const fp = path.join(dir, f.name);
      if (f.isDirectory()) size += getDirSize(fp);
      else size += fs.statSync(fp).size;
    }
  } catch (e) {}
  return size;
}

function getAllModRoots() {
  return [getModsDir(), getDisabledDir(), getLegacyDisabledDir()].filter(Boolean);
}

function findFolderModLocation(folderName) {
  for (const root of getAllModRoots()) {
    const candidate = path.join(root, folderName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findFlatModBaseDir(files) {
  for (const root of getAllModRoots()) {
    if (files.some(file => fs.existsSync(path.join(root, file)))) return root;
  }
  return null;
}

// ── IPC Handlers ──

ipcMain.handle('app:init', () => {
  const cfg = loadConfig();
  // Prefer saved path if it still exists
  if (cfg.gamePath && fs.existsSync(cfg.gamePath)) {
    gamePath = cfg.gamePath;
  } else {
    gamePath = detectGamePath();
    if (gamePath) { cfg.gamePath = gamePath; saveConfig(cfg); }
  }
  migrateLegacyDisabledDir();
  return { gamePath, modsDir: getModsDir() };
});

ipcMain.handle('app:selectGamePath', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择 Slay the Spire 2 游戏目录',
    properties: ['openDirectory'],
    defaultPath: gamePath || undefined,
  });
  if (!result.canceled && result.filePaths[0]) {
    gamePath = result.filePaths[0];
    // Persist the manually selected path
    const cfg = loadConfig();
    cfg.gamePath = gamePath;
    saveConfig(cfg);
    migrateLegacyDisabledDir();
    return { gamePath, modsDir: getModsDir() };
  }
  return null;
});

ipcMain.handle('mods:scan', () => scanMods());

ipcMain.handle('mods:toggle', (_, modInfo) => {
  const modsDir = getModsDir();
  const disabledDir = getDisabledDir();
  if (!modsDir || !disabledDir) return { success: false, error: 'Game path not set' };

  try {
    if (modInfo.isFolder) {
      const src = findFolderModLocation(modInfo.folderName);
      if (!src) throw new Error(`找不到 MOD 文件夹: ${modInfo.folderName}`);

      const srcRoot = path.dirname(src);
      const dst = path.resolve(srcRoot) === path.resolve(modsDir)
        ? path.join(disabledDir, modInfo.folderName)
        : path.join(modsDir, modInfo.folderName);

      if (path.resolve(src) === path.resolve(dst)) {
        return { success: true };
      }

      fs.renameSync(src, dst);
    } else {
      const srcBaseDir = findFlatModBaseDir(modInfo.files);
      if (!srcBaseDir) throw new Error(`找不到 MOD 文件: ${modInfo.files.join(', ')}`);

      const dstBaseDir = path.resolve(srcBaseDir) === path.resolve(modsDir)
        ? disabledDir
        : modsDir;

      for (const file of modInfo.files) {
        const src = path.join(srcBaseDir, file);
        const dst = path.join(dstBaseDir, file);
        if (fs.existsSync(src)) {
          fs.renameSync(src, dst);
        }
      }
    }
    return { success: true, mods: scanMods() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('mods:uninstall', (_, modInfo) => {
  const modsDir = getModsDir();
  const disabledDir = getDisabledDir();
  if (!modsDir) return { success: false, error: 'Game path not set' };

  try {
    if (modInfo.isFolder) {
      const modPath = findFolderModLocation(modInfo.folderName);
      if (!modPath) throw new Error(`找不到 MOD 文件夹: ${modInfo.folderName}`);
      fs.rmSync(modPath, { recursive: true, force: true });
    } else {
      const baseDir = findFlatModBaseDir(modInfo.files);
      if (!baseDir) throw new Error(`找不到 MOD 文件: ${modInfo.files.join(', ')}`);

      for (const file of modInfo.files) {
        const filePath = path.join(baseDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
    return { success: true, mods: scanMods() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

function smartExtractZip(zipPath, modsDir) {
  const ext = path.extname(zipPath).toLowerCase();
  if (ext !== '.zip') {
    throw new Error(
      `不支持的格式: ${ext}\n\n` +
      `目前仅支持 .zip 格式的压缩包。\n` +
      `如果是 .rar / .7z 请先解压后拖入文件夹，或转换为 .zip 格式。`
    );
  }

  let zip;
  try {
    zip = new AdmZip(zipPath);
  } catch (e) {
    throw new Error(
      `无法读取压缩包: ${path.basename(zipPath)}\n\n` +
      `该文件可能已损坏或不是有效的 ZIP 格式。\n\n` +
      `MOD 压缩包应为 .zip 格式，内含以下文件之一:\n` +
      `  • ModName.json (MOD 描述文件)\n` +
      `  • ModName.dll (代码类 MOD)\n` +
      `  • ModName.pck (资源类 MOD)`
    );
  }

  const entries = zip.getEntries();
  if (entries.length === 0) {
    throw new Error(`压缩包为空: ${path.basename(zipPath)}`);
  }

  // ── Smart search: find MOD manifest JSON files inside the ZIP ──
  const modRoots = []; // { prefix, folderName }
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const entryPath = entry.entryName.replace(/\\/g, '/');
    if (!entryPath.endsWith('.json')) continue;
    try {
      const content = JSON.parse(entry.getData().toString('utf8'));
      if (content.id && content.name) {
        // Found a MOD manifest — determine its parent directory
        const parts = entryPath.split('/');
        if (parts.length >= 2) {
          // e.g. "SomeFolder/SubDir/MyMod/MyMod.json" → modDir = "SomeFolder/SubDir/MyMod", prefix = "SomeFolder/SubDir/"
          const modDir = parts.slice(0, -1).join('/');
          const folderName = parts[parts.length - 2];
          const prefix = parts.slice(0, -2).join('/');
          modRoots.push({ prefix: prefix ? prefix + '/' : '', folderName, modDir });
        } else {
          // JSON at root level — flat mod
          modRoots.push({ prefix: '', folderName: null, modDir: null });
        }
      }
    } catch (e) { /* not valid JSON or not a manifest */ }
  }

  if (modRoots.length > 0) {
    // Extract each found MOD to the mods directory
    for (const mr of modRoots) {
      if (mr.modDir) {
        // Folder mod: extract entries under modDir/ into modsDir/folderName/
        const destDir = path.join(modsDir, mr.folderName);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const modPrefix = mr.modDir + '/';
        for (const entry of entries) {
          const ep = entry.entryName.replace(/\\/g, '/');
          if (!ep.startsWith(modPrefix)) continue;
          const relativePath = ep.substring(modPrefix.length);
          if (!relativePath) continue;
          const outPath = path.join(destDir, relativePath);
          if (entry.isDirectory) {
            if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });
          } else {
            const parentDir = path.dirname(outPath);
            if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
            fs.writeFileSync(outPath, entry.getData());
          }
        }
      } else {
        // Flat mod at root: extract all root-level files to modsDir
        for (const entry of entries) {
          const ep = entry.entryName.replace(/\\/g, '/');
          if (ep.includes('/') || entry.isDirectory) continue;
          fs.writeFileSync(path.join(modsDir, ep), entry.getData());
        }
      }
    }
    return;
  }

  // ── Fallback: no manifest found, use legacy extraction ──
  const topDirs = new Set();
  let hasRootFile = false;
  for (const entry of entries) {
    const parts = entry.entryName.replace(/\\/g, '/').split('/');
    if (parts.length === 1 && !entry.isDirectory) {
      hasRootFile = true;
      break;
    }
    if (parts[0]) topDirs.add(parts[0]);
  }

  if (!hasRootFile && topDirs.size === 1) {
    zip.extractAllTo(modsDir, true);
  } else {
    const baseName = path.basename(zipPath, path.extname(zipPath));
    const subDir = path.join(modsDir, baseName);
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    zip.extractAllTo(subDir, true);
  }

  // ── Post-extraction check: warn if no MOD was found ──
  const fileList = entries.map(e => e.entryName).join(', ');
  const hasModFile = entries.some(e => {
    const n = e.entryName.toLowerCase();
    return n.endsWith('.json') || n.endsWith('.dll') || n.endsWith('.pck');
  });
  if (!hasModFile) {
    throw new Error(
      `压缩包已解压，但未检测到 MOD 文件。\n\n` +
      `压缩包内容: ${fileList.substring(0, 200)}${fileList.length > 200 ? '...' : ''}\n\n` +
      `有效的 MOD 压缩包应包含:\n` +
      `  • ModName.json (MOD 描述文件，必须含 id 和 name 字段)\n` +
      `  • ModName.dll (代码类 MOD) 和/或\n` +
      `  • ModName.pck (资源类 MOD)\n\n` +
      `请确认下载的是正确的 MOD 文件。`
    );
  }
}

function installFolder(folderPath, modsDir) {
  const folderName = path.basename(folderPath);
  const dest = path.join(modsDir, folderName);
  fs.cpSync(folderPath, dest, { recursive: true });
}

ipcMain.handle('mods:install', async () => {
  const modsDir = getModsDir();
  if (!modsDir) return { success: false, error: 'Game path not set' };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择 MOD 压缩包或文件夹',
    filters: [{ name: 'Archives', extensions: ['zip'] }],
    properties: ['openFile', 'openDirectory', 'multiSelections'],
  });

  if (result.canceled) return { success: false, error: 'Cancelled' };

  const installed = [];
  for (const filePath of result.filePaths) {
    try {
      if (fs.statSync(filePath).isDirectory()) {
        installFolder(filePath, modsDir);
      } else {
        smartExtractZip(filePath, modsDir);
      }
      installed.push(path.basename(filePath));
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: true, installed, mods: scanMods() };
});

ipcMain.handle('mods:installDrop', async (_, filePaths) => {
  const modsDir = getModsDir();
  if (!modsDir) return { success: false, error: 'Game path not set' };

  const installed = [];
  for (const filePath of filePaths) {
    try {
      if (fs.statSync(filePath).isDirectory()) {
        installFolder(filePath, modsDir);
      } else {
        smartExtractZip(filePath, modsDir);
      }
      installed.push(path.basename(filePath));
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: true, installed, mods: scanMods() };
});

// ── Open folders ──
ipcMain.handle('shell:openModsDir', () => {
  const dir = getModsDir();
  if (dir && fs.existsSync(dir)) shell.openPath(dir);
});

ipcMain.handle('shell:openGameDir', () => {
  if (gamePath) shell.openPath(gamePath);
});

ipcMain.handle('shell:openLogsDir', () => {
  const logsDir = path.join(process.env.APPDATA, 'SlayTheSpire2', 'logs');
  if (fs.existsSync(logsDir)) shell.openPath(logsDir);
});

ipcMain.handle('shell:openSavesDir', () => {
  const savesDir = path.join(process.env.APPDATA, 'SlayTheSpire2');
  if (fs.existsSync(savesDir)) shell.openPath(savesDir);
});

ipcMain.handle('shell:openUrl', (_, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

// ── Translate ──
const { net } = require('electron');

ipcMain.handle('translate:text', async (_, text) => {
  if (!text || !text.trim()) return { success: false, error: '无内容' };
  try {
    const encoded = encodeURIComponent(text.trim());
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|zh-CN`;
    const response = await net.fetch(url);
    const data = await response.json();
    if (data.responseStatus === 200 && data.responseData) {
      return { success: true, translated: data.responseData.translatedText };
    }
    return { success: false, error: data.responseDetails || '翻译失败' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Translation persistence ──
const TRANSLATIONS_PATH = path.join(process.env.APPDATA, 'STS2ModManager', 'translations.json');
function loadTranslations() {
  try {
    if (fs.existsSync(TRANSLATIONS_PATH)) return JSON.parse(fs.readFileSync(TRANSLATIONS_PATH, 'utf-8'));
  } catch (e) {}
  return {};
}
function saveTranslations(data) {
  try {
    const dir = path.dirname(TRANSLATIONS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TRANSLATIONS_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

ipcMain.handle('translations:load', () => loadTranslations());
ipcMain.handle('translations:save', (_, data) => { saveTranslations(data); return true; });

// ── Launch game ──
const { exec } = require('child_process');

let gameState = 'idle'; // idle | launching | running
let gameStartTime = null;

function findGameProcess() {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq SlayTheSpire2.exe" /FO CSV /NH', (err, stdout) => {
      if (err) return resolve(false);
      resolve(stdout.includes('SlayTheSpire2.exe'));
    });
  });
}

function watchGameProcess() {
  const poll = setInterval(async () => {
    const running = await findGameProcess();
    if (gameState === 'launching' && running) {
      gameState = 'running';
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('game:stateChanged', 'running');
      }
    } else if (gameState === 'launching' && !running) {
      // Still waiting for Steam to start the game
      const elapsed = Date.now() - gameStartTime;
      if (elapsed > 60000) {
        // Timeout after 60s
        gameState = 'idle';
        clearInterval(poll);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('game:stateChanged', 'idle');
          mainWindow.webContents.send('game:exited', { quick: true });
        }
      }
    } else if (gameState === 'running' && !running) {
      // Game exited
      const sessionTime = Date.now() - gameStartTime;
      gameState = 'idle';
      clearInterval(poll);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('game:stateChanged', 'idle');
        mainWindow.webContents.send('game:exited', { quick: sessionTime < 30000 });
      }
    }
  }, 2000);
}

ipcMain.handle('game:launch', async () => {
  if (gameState !== 'idle') return { success: false, error: '游戏已在运行' };
  gameState = 'launching';
  gameStartTime = Date.now();

  // Determine launch method based on game path
  // steamapps in path → Steam copy → use Steam protocol
  // Otherwise → launch EXE directly
  let method = 'steam';
  if (gamePath && gamePath.toLowerCase().includes('steamapps')) {
    shell.openExternal('steam://rungameid/2868840');
  } else if (gamePath) {
    const exePath = path.join(gamePath, 'SlayTheSpire2.exe');
    if (fs.existsSync(exePath)) {
      exec(`"${exePath}"`, { cwd: gamePath });
      method = 'direct';
    } else {
      shell.openExternal('steam://rungameid/2868840');
    }
  } else {
    shell.openExternal('steam://rungameid/2868840');
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('game:stateChanged', 'launching');
  }
  // Start polling after short delay
  setTimeout(() => watchGameProcess(), method === 'direct' ? 1000 : 3000);
  return { success: true, method };
});

ipcMain.handle('game:getState', () => gameState);

// ── Crash analysis ──
const CRASH_PATTERNS = [
  { pattern: /State divergence|StateDivergence/i, reason: '联机状态不同步', detail: '你的客户端状态与房主不一致，被服务器踢出。确保双方 MOD 完全相同。' },
  { pattern: /OutOfMemoryException|out of memory/i, reason: '内存不足', detail: '游戏耗尽内存。尝试关闭后台程序，或减少加载的 MOD 数量。' },
  { pattern: /StackOverflowException/i, reason: '堆栈溢出', detail: '可能是某个 MOD 导致无限递归。尝试逐个禁用 MOD 排查。' },
  { pattern: /NullReferenceException/i, reason: '空引用异常', detail: 'MOD 或游戏内部发生空引用异常。' },
  { pattern: /FileNotFoundException.*\.dll/i, reason: 'DLL 文件缺失', detail: 'MOD 依赖的 DLL 文件未找到，检查 MOD 依赖是否完整安装。' },
  { pattern: /is missing the 'id' field/i, reason: 'MOD 清单格式错误', detail: '部分 MOD 的 manifest 文件缺少 id 字段，游戏无法加载这些 MOD。' },
  { pattern: /Connection timed out/i, reason: '网络连接超时', detail: '联机服务器连接超时，检查网络状况或更换服务器。' },
  { pattern: /FATAL|Unhandled exception|Application crashed/i, reason: '致命错误', detail: '游戏发生未处理的异常导致崩溃。' },
  { pattern: /GPU.*crash|Vulkan.*error|rendering.*device.*lost/i, reason: '显卡驱动崩溃', detail: '渲染设备丢失，尝试更新显卡驱动或降低画质设置。' },
];

// Extract mod name from a log line containing a path like ...mods\SomeMod\... or ...mods\SomeMod.json
function extractModFromLine(line) {
  // Match mods\ModName\ or mods\ModName.json or mods\ModName.dll
  const m = line.match(/mods[\\\/]([^\\\/]+?)(?:[\\\/]|\.(json|dll|pck))/i);
  if (m) return m[1];
  // Match "for 'ModDisplayName' (mod_id)"
  const m2 = line.match(/for '([^']+)' \(([^)]+)\)/);
  if (m2) return m2[1];
  // Match "mod_id," or namespace like ModNamespace.Something
  const m3 = line.match(/\b([A-Z][a-zA-Z0-9_]+(?:\.(?:Scripts|Entry|Core))?)\b/);
  return null;
}

function analyzeModsFromLog(content) {
  const lines = content.split('\n');
  const loadedMods = [];      // Mods that loaded successfully
  const failedManifests = []; // { dir, file } manifests that errored
  const errorMods = new Map(); // mod -> [error descriptions]

  for (const line of lines) {
    // Track loaded mods: "Finished mod initialization for 'Name' (id)"
    const loadMatch = line.match(/Finished mod initialization for '([^']+)' \(([^)]+)\)/);
    if (loadMatch) {
      loadedMods.push({ name: loadMatch[1], id: loadMatch[2] });
      continue;
    }

    // Track failed manifests with the specific file name
    const manifestFail = line.match(/\[ERROR\].*Mod manifest.*mods[\\\/]([^\\\/]+)[\\\/]([^\\\/\s]+).*is missing/);
    if (manifestFail) {
      failedManifests.push({ dir: manifestFail[1], file: manifestFail[2] });
      continue;
    }

    // Track errors mentioning mods (skip manifest errors, already handled above)
    if (line.includes('[ERROR]') && !line.includes('Mod manifest') && !line.includes('is missing the')) {
      const mod = extractModFromLine(line);
      if (mod) {
        if (!errorMods.has(mod)) errorMods.set(mod, []);
        errorMods.get(mod).push(line.replace(/^\s*\[ERROR\]\s*/, '').slice(0, 120));
      }
    }

    // Check exception stack traces for mod namespaces (skip engine internals)
    if (line.match(/^\s+at\s+/) && !line.includes('MegaCrit') && !line.includes('Godot') && !line.includes('System')) {
      const nsMod = line.match(/at\s+([A-Za-z0-9_]+)\./);
      if (nsMod) {
        const modName = nsMod[1];
        if (!errorMods.has(modName)) errorMods.set(modName, []);
        errorMods.get(modName).push('异常堆栈中出现: ' + line.trim().slice(0, 120));
      }
    }
  }

  // Cross-reference: separate truly failed mods from false positives (config files in loaded mods)
  const loadedIds = new Set(loadedMods.map(m => m.id));
  const loadedDirs = new Set(loadedMods.map(m => m.id)); // mod id often matches dir name
  const reallyFailedMods = [];
  const configWarnings = [];

  for (const { dir, file } of failedManifests) {
    // If this mod actually loaded successfully, it's just a non-manifest JSON being scanned
    if (loadedIds.has(dir) || loadedMods.some(m => m.id === dir || m.name === dir || dir.toLowerCase().includes(m.id.toLowerCase()))) {
      configWarnings.push({ dir, file, note: `${file} 不是 MOD 清单，是配置文件（MOD 已正常加载）` });
    } else {
      reallyFailedMods.push(dir);
    }
  }

  return { loadedMods, reallyFailedMods, configWarnings, errorMods };
}

ipcMain.handle('game:analyzeCrash', () => {
  const logsDir = path.join(process.env.APPDATA, 'SlayTheSpire2', 'logs');
  if (!fs.existsSync(logsDir)) return { issues: [], logFile: null, involvedMods: [] };

  const files = fs.readdirSync(logsDir)
    .filter(f => f.startsWith('godot2') && f.endsWith('.log'))
    .map(f => ({ name: f, time: fs.statSync(path.join(logsDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) return { issues: [], logFile: null, involvedMods: [] };

  const latestFile = files[0].name;
  const filePath = path.join(logsDir, latestFile);
  const content = readLogSafe(filePath);

  // Mod-level analysis (do this first so we can use results in issue generation)
  const { loadedMods, reallyFailedMods, configWarnings, errorMods } = analyzeModsFromLog(content);

  // Pattern-based issues
  const issues = [];
  const seen = new Set();
  for (const { pattern, reason, detail } of CRASH_PATTERNS) {
    if (pattern.test(content) && !seen.has(reason)) {
      // Skip manifest error issue if all "failures" were just config files
      if (reason === 'MOD 清单格式错误' && reallyFailedMods.length === 0) continue;
      seen.add(reason);
      issues.push({ reason, detail, mods: [] });
    }
  }

  // Attach mod names to issues
  for (const issue of issues) {
    if (issue.reason === 'MOD 清单格式错误' && reallyFailedMods.length > 0) {
      issue.mods = reallyFailedMods;
      issue.detail = `以下 MOD 的 manifest 文件缺少 id 字段，真正无法加载: ${reallyFailedMods.join(', ')}`;
    }
    if (issue.reason === '联机状态不同步' && loadedMods.length > 0) {
      issue.mods = loadedMods.map(m => m.name);
      issue.detail += ` 请确认双方加载的 MOD 完全一致: ${loadedMods.map(m => m.name).join(', ')}`;
    }
    if (issue.reason === '空引用异常') {
      // Find mods mentioned in error context
      const relatedMods = [...errorMods.keys()];
      if (relatedMods.length > 0) {
        issue.mods = relatedMods;
        issue.detail += ` 可能涉及: ${relatedMods.join(', ')}`;
      }
    }
  }

  // Build involved mods summary: only mods that actually had real errors
  const involvedMods = [];
  for (const [modName, errors] of errorMods.entries()) {
    involvedMods.push({
      name: modName,
      errorCount: errors.length,
      sample: errors[0] || '',
    });
  }
  // Add truly failed mods (not loaded at all)
  for (const mod of reallyFailedMods) {
    if (!involvedMods.find(m => m.name === mod)) {
      involvedMods.push({
        name: mod,
        errorCount: 1,
        sample: 'manifest 格式不正确，MOD 未加载',
      });
    }
  }
  involvedMods.sort((a, b) => b.errorCount - a.errorCount);

  // Config warnings (informational, not errors)
  const notices = configWarnings.map(w => `${w.dir}/${w.file}: ${w.note}`);

  // Count real ERROR / WARN lines (exclude manifest config false positives)
  const allLines = content.split('\n');
  const errorCount = allLines.filter(l => l.includes('[ERROR]')).length;
  const warnCount = allLines.filter(l => l.includes('[WARN]')).length;

  return {
    issues,
    logFile: latestFile,
    errorCount,
    warnCount,
    involvedMods,
    loadedMods: loadedMods.map(m => m.name),
    notices,
  };
});

// ── Game version ──
ipcMain.handle('game:getVersion', () => {
  const logsDir = path.join(process.env.APPDATA, 'SlayTheSpire2', 'logs');
  if (!fs.existsSync(logsDir)) return { version: null, engine: null };
  // Try latest rotated log first (has full session), then godot.log (current/new session)
  const candidates = [];
  const rotated = fs.readdirSync(logsDir)
    .filter(f => f.startsWith('godot2') && f.endsWith('.log'))
    .map(f => ({ name: f, time: fs.statSync(path.join(logsDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  if (rotated.length > 0) candidates.push(rotated[0].name);
  candidates.push('godot.log');

  for (const fname of candidates) {
    const fp = path.join(logsDir, fname);
    if (!fs.existsSync(fp)) continue;
    const stat = fs.statSync(fp);
    // Version info is in system dump near end of log; read last 16KB
    const readSize = Math.min(stat.size, 16384);
    const fd = fs.openSync(fp, 'r');
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));
    fs.closeSync(fd);
    const tail = buf.toString('utf-8');
    const verMatch = tail.match(/Release Version:\s*(.+)/);
    const engineMatch = tail.match(/Engine Version:\s*(.+)/);
    if (verMatch) {
      return {
        version: verMatch[1].trim(),
        engine: engineMatch ? engineMatch[1].trim() : null,
      };
    }
  }
  return { version: null, engine: null };
});

// ── Read logs ──
const MAX_LOG_FILES = 50;
const MAX_LOG_SIZE = 512 * 1024; // 512 KB

function readLogSafe(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const stat = fs.statSync(filePath);
  if (stat.size <= MAX_LOG_SIZE) return fs.readFileSync(filePath, 'utf-8');
  // Read only the last MAX_LOG_SIZE bytes
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(MAX_LOG_SIZE);
  fs.readSync(fd, buf, 0, MAX_LOG_SIZE, stat.size - MAX_LOG_SIZE);
  fs.closeSync(fd);
  const text = buf.toString('utf-8');
  const firstNewline = text.indexOf('\n');
  return '[... 日志过长，仅显示末尾部分 ...]\n' + text.slice(firstNewline + 1);
}

ipcMain.handle('logs:getLatest', () => {
  const logsDir = path.join(process.env.APPDATA, 'SlayTheSpire2', 'logs');
  if (!fs.existsSync(logsDir)) return { files: [], content: '' };

  const files = fs.readdirSync(logsDir)
    .filter(f => f.endsWith('.log'))
    .map(f => ({
      name: f,
      time: fs.statSync(path.join(logsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time)
    .slice(0, MAX_LOG_FILES);

  const latestContent = files.length > 0
    ? readLogSafe(path.join(logsDir, files[0].name))
    : '';

  return { files: files.map(f => f.name), content: latestContent };
});

ipcMain.handle('logs:read', (_, fileName) => {
  const logsDir = path.join(process.env.APPDATA, 'SlayTheSpire2', 'logs');
  return readLogSafe(path.join(logsDir, fileName));
});

// ── Profiles ──
function getProfilesPath() {
  const dir = path.join(process.env.APPDATA, 'STS2ModManager');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'profiles.json');
}

ipcMain.handle('profiles:load', () => {
  const p = getProfilesPath();
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  return {};
});

ipcMain.handle('profiles:save', (_, profiles) => {
  fs.writeFileSync(getProfilesPath(), JSON.stringify(profiles, null, 2));
  return { success: true };
});

// ── Backup ──
ipcMain.handle('mods:backup', async () => {
  const modsDir = getModsDir();
  if (!modsDir) return { success: false, error: 'Game path not set' };

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save MOD Backup',
    defaultPath: `sts2_mods_backup_${Date.now()}.zip`,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  });

  if (result.canceled) return { success: false };

  try {
    const zip = new AdmZip();
    zip.addLocalFolder(modsDir);
    zip.writeZip(result.filePath);
    return { success: true, path: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── Save management ──
function getSteamUserDir() {
  const steamDir = path.join(process.env.APPDATA, 'SlayTheSpire2', 'steam');
  if (!fs.existsSync(steamDir)) return null;
  const users = fs.readdirSync(steamDir).filter(d => /^\d+$/.test(d));
  if (users.length === 0) return null;
  return path.join(steamDir, users[0]);
}

function getSaveBackupDir() {
  const dir = path.join(process.env.APPDATA, 'STS2ModManager', 'save_backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function parseProgressSummary(progressPath) {
  if (!fs.existsSync(progressPath)) return null;
  try {
    const raw = fs.readFileSync(progressPath, 'utf-8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    const characters = (data.character_stats || []).map(c => ({
      id: c.id,
      wins: c.total_wins || 0,
      losses: c.total_losses || 0,
      maxAscension: c.max_ascension || 0,
      playtime: c.playtime || 0,
      bestStreak: c.best_win_streak || 0,
    })).filter(c => c.wins > 0 || c.losses > 0);

    return {
      totalPlaytime: data.total_playtime || 0,
      floorsClimbed: data.floors_climbed || 0,
      currentScore: data.current_score || 0,
      totalUnlocks: data.total_unlocks || 0,
      discoveredCards: (data.discovered_cards || []).length,
      discoveredRelics: (data.discovered_relics || []).length,
      epochs: (data.epochs || []).length,
      characters,
      uniqueId: data.unique_id || '',
    };
  } catch (e) {
    return null;
  }
}

function scanSaveSlot(userDir, slotName, modded) {
  const prefix = modded ? path.join(userDir, 'modded', slotName) : path.join(userDir, slotName);
  if (!fs.existsSync(prefix)) return null;
  const savesDir = path.join(prefix, 'saves');
  const progressPath = path.join(savesDir, 'progress.save');
  const hasProgress = fs.existsSync(progressPath);
  const hasPrefs = fs.existsSync(path.join(savesDir, 'prefs.save'));
  let lastModified = 0;
  let totalSize = 0;
  if (fs.existsSync(savesDir)) {
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, f.name);
        if (f.isDirectory()) { walk(fp); continue; }
        const st = fs.statSync(fp);
        totalSize += st.size;
        if (st.mtimeMs > lastModified) lastModified = st.mtimeMs;
      }
    };
    walk(savesDir);
  }
  const replaysDir = path.join(prefix, 'replays');
  if (fs.existsSync(replaysDir)) {
    const walk2 = (dir) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, f.name);
        if (f.isDirectory()) { walk2(fp); continue; }
        const st = fs.statSync(fp);
        totalSize += st.size;
      }
    };
    walk2(replaysDir);
  }

  const summary = parseProgressSummary(progressPath);

  return {
    slot: slotName,
    modded,
    path: prefix,
    hasProgress,
    hasPrefs,
    empty: !hasProgress && !hasPrefs,
    lastModified: lastModified > 0 ? new Date(lastModified).toISOString() : null,
    size: totalSize,
    summary,
  };
}

ipcMain.handle('saves:scan', () => {
  const userDir = getSteamUserDir();
  if (!userDir) return { slots: [], backups: [] };

  const slots = [];
  for (const s of ['profile1', 'profile2', 'profile3']) {
    const normal = scanSaveSlot(userDir, s, false);
    if (normal) slots.push(normal);
    const modded = scanSaveSlot(userDir, s, true);
    if (modded) slots.push(modded);
  }

  // Scan backups
  const backupDir = getSaveBackupDir();
  const backups = [];
  if (fs.existsSync(backupDir)) {
    for (const f of fs.readdirSync(backupDir).filter(f => f.endsWith('.zip')).sort().reverse()) {
      const fp = path.join(backupDir, f);
      const st = fs.statSync(fp);
      backups.push({ name: f, path: fp, size: st.size, time: st.mtime.toISOString() });
    }
  }
  return { slots, backups };
});

ipcMain.handle('saves:export', async (_, { slot, modded }) => {
  const userDir = getSteamUserDir();
  if (!userDir) return { success: false, error: '未找到游戏存档目录' };

  const prefix = modded ? path.join(userDir, 'modded', slot) : path.join(userDir, slot);
  if (!fs.existsSync(prefix)) return { success: false, error: '该存档槽位为空' };

  const tag = modded ? `${slot}_modded` : slot;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultName = `STS2_Save_${tag}_${timestamp}.zip`;

  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出存档',
    defaultPath: defaultName,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  });
  if (result.canceled) return { success: false };

  try {
    const zip = new AdmZip();
    // Store metadata
    zip.addFile('_meta.json', Buffer.from(JSON.stringify({ slot, modded, exportTime: new Date().toISOString() }, null, 2)));
    // Add save folder
    const addDir = (dir, zipPrefix) => {
      if (!fs.existsSync(dir)) return;
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, f.name);
        const zp = zipPrefix + '/' + f.name;
        if (f.isDirectory()) addDir(fp, zp);
        else zip.addLocalFile(fp, zipPrefix);
      }
    };
    addDir(prefix, slot);
    zip.writeZip(result.filePath);
    return { success: true, path: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('saves:import', async (_, { slot, modded }) => {
  const userDir = getSteamUserDir();
  if (!userDir) return { success: false, error: '未找到游戏存档目录' };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入存档到 ' + slot,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    properties: ['openFile'],
  });
  if (result.canceled) return { success: false };

  try {
    const zip = new AdmZip(result.filePaths[0]);
    const entries = zip.getEntries();

    // Determine root folder in zip (may be profile1/ profile2/ etc.)
    const folders = [...new Set(entries.map(e => e.entryName.split('/')[0]))];
    const sourceSlot = folders.find(f => /^profile\d$/.test(f)) || folders[0];

    const targetDir = modded ? path.join(userDir, 'modded', slot) : path.join(userDir, slot);

    // Backup current slot first
    if (fs.existsSync(targetDir)) {
      const backupDir = getSaveBackupDir();
      const tag = modded ? `${slot}_modded` : slot;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupZip = new AdmZip();
      const addDir2 = (dir, zipPrefix) => {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
          const fp = path.join(dir, f.name);
          if (f.isDirectory()) addDir2(fp, zipPrefix + '/' + f.name);
          else backupZip.addLocalFile(fp, zipPrefix);
        }
      };
      addDir2(targetDir, slot);
      backupZip.writeZip(path.join(backupDir, `auto_backup_${tag}_${ts}.zip`));
    }

    // Extract, remapping source slot to target slot
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (entry.entryName === '_meta.json') continue;
      // Remap: replace source slot prefix with target slot name
      let relPath = entry.entryName;
      if (relPath.startsWith(sourceSlot + '/')) {
        relPath = relPath.slice(sourceSlot.length + 1);
      }
      const dest = path.join(targetDir, relPath);
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(dest, entry.getData());
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('saves:deleteBackup', (_, backupPath) => {
  try {
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('mods:restore', async () => {
  const modsDir = getModsDir();
  if (!modsDir) return { success: false, error: 'Game path not set' };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select MOD Backup',
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    properties: ['openFile'],
  });

  if (result.canceled) return { success: false };

  try {
    const zip = new AdmZip(result.filePaths[0]);
    zip.extractAllTo(modsDir, true);
    return { success: true, mods: scanMods() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
