const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // App
  init: () => ipcRenderer.invoke('app:init'),
  selectGamePath: () => ipcRenderer.invoke('app:selectGamePath'),

  // Window
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Mods
  scanMods: () => ipcRenderer.invoke('mods:scan'),
  toggleMod: (modInfo) => ipcRenderer.invoke('mods:toggle', modInfo),
  uninstallMod: (modInfo) => ipcRenderer.invoke('mods:uninstall', modInfo),
  installMod: () => ipcRenderer.invoke('mods:install'),
  installDrop: (filePaths) => ipcRenderer.invoke('mods:installDrop', filePaths),
  backupMods: () => ipcRenderer.invoke('mods:backup'),
  restoreMods: () => ipcRenderer.invoke('mods:restore'),

  // Shell
  openModsDir: () => ipcRenderer.invoke('shell:openModsDir'),
  openGameDir: () => ipcRenderer.invoke('shell:openGameDir'),
  openLogsDir: () => ipcRenderer.invoke('shell:openLogsDir'),
  openSavesDir: () => ipcRenderer.invoke('shell:openSavesDir'),
  openUrl: (url) => ipcRenderer.invoke('shell:openUrl', url),

  // Game
  launchGame: () => ipcRenderer.invoke('game:launch'),
  getGameState: () => ipcRenderer.invoke('game:getState'),
  getGameVersion: () => ipcRenderer.invoke('game:getVersion'),
  analyzeCrash: () => ipcRenderer.invoke('game:analyzeCrash'),
  onGameStateChanged: (cb) => { ipcRenderer.on('game:stateChanged', (_, state) => cb(state)); },
  onGameExited: (cb) => { ipcRenderer.on('game:exited', (_, info) => cb(info)); },

  // Logs
  getLatestLogs: () => ipcRenderer.invoke('logs:getLatest'),
  readLog: (fileName) => ipcRenderer.invoke('logs:read', fileName),

  // Profiles
  loadProfiles: () => ipcRenderer.invoke('profiles:load'),
  saveProfiles: (profiles) => ipcRenderer.invoke('profiles:save', profiles),

  // Translate
  translateText: (text) => ipcRenderer.invoke('translate:text', text),
  loadTranslations: () => ipcRenderer.invoke('translations:load'),
  saveTranslations: (data) => ipcRenderer.invoke('translations:save', data),

  // Saves
  scanSaves: () => ipcRenderer.invoke('saves:scan'),
  exportSave: (opts) => ipcRenderer.invoke('saves:export', opts),
  importSave: (opts) => ipcRenderer.invoke('saves:import', opts),
  deleteBackup: (backupPath) => ipcRenderer.invoke('saves:deleteBackup', backupPath),
});
