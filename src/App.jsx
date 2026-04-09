import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from './i18n';
import Sidebar from './components/Sidebar';
import ModCard from './components/ModCard';
import ModListItem from './components/ModListItem';
import ModDetail from './components/ModDetail';
import LogViewer from './components/LogViewer';
import SaveManager from './components/SaveManager';
import TitleBar from './components/TitleBar';
import {
  Download, RefreshCw, Search, FolderOpen, Archive, UploadCloud, Play, Loader, X, AlertTriangle, Info,
  ToggleLeft, ToggleRight, Trash2, Layers, Save, ChevronDown, Package, LayoutGrid, List,
  ArrowUpDown, CheckCircle2, Circle, Rocket,
} from 'lucide-react';

export default function App() {
  const [page, setPage] = useState('mods');
  const [mods, setMods] = useState([]);
  const [selectedMod, setSelectedMod] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [gamePath, setGamePath] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [gameState, setGameState] = useState('idle');
  const [crashReport, setCrashReport] = useState(null);
  const [gameVersion, setGameVersion] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [showProfiles, setShowProfiles] = useState(false);
  const [profiles, setProfiles] = useState({});
  const [newProfileName, setNewProfileName] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [translations, setTranslations] = useState({});
  const { t } = useTranslation();

  useEffect(() => {
    window.api.getGameState().then(setGameState);
    window.api.getGameVersion().then(v => { if (v.version) setGameVersion(v.version); });
    window.api.onGameStateChanged((state) => setGameState(state));
    window.api.onGameExited(async (info) => {
      const v = await window.api.getGameVersion();
      if (v.version) setGameVersion(v.version);
      const report = await window.api.analyzeCrash();
      if (report && (report.issues.length > 0 || report.errorCount > 0)) {
        setCrashReport(report);
      }
    });
    window.api.loadProfiles().then(setProfiles);
    if (window.api.loadTranslations) window.api.loadTranslations().then(setTranslations);
  }, []);

  const handleLaunchGame = async () => {
    if (gameState !== 'idle') return;
    const result = await window.api.launchGame();
    if (!result.success && result.error) showToast(result.error, 'error');
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const syncMods = useCallback((list) => {
    setMods(list);
    setSelectedMod((prev) => {
      if (!prev?.instanceKey) return null;
      return list.find((m) => m.instanceKey === prev.instanceKey) || null;
    });
  }, []);

  const refreshMods = useCallback(async () => {
    setLoading(true);
    const list = await window.api.scanMods();
    syncMods(list);
    setLoading(false);
  }, [syncMods]);

  useEffect(() => {
    (async () => {
      const info = await window.api.init();
      setGamePath(info.gamePath);
      if (info.gamePath) {
        const list = await window.api.scanMods();
        syncMods(list);
      }
    })();
  }, [syncMods]);

  const handleSelectGamePath = async () => {
    const info = await window.api.selectGamePath();
    if (info) { setGamePath(info.gamePath); refreshMods(); }
  };

  const handleToggle = async (mod) => {
    const result = await window.api.toggleMod(mod);
    if (result.success) {
      showToast(t('app.toast.modToggle', '{name} {action}', { name: mod.name, action: mod.enabled ? t('app.disable', 'Disabled') : t('app.enable', 'Enabled') }));
      if (result.mods) syncMods(result.mods); else refreshMods();
    } else showToast(result.error, 'error');
  };

  const doUninstall = async (mod) => {
    const result = await window.api.uninstallMod(mod);
    if (result.success) {
      showToast(t('app.toast.modUninstalled', '{name} uninstalled', { name: mod.name }));
      if (result.mods) syncMods(result.mods); else refreshMods();
    } else showToast(result.error, 'error');
  };

  const handleUninstall = (mod) => {
    const dependents = mods.filter(m => m.dependencies && m.dependencies.includes(mod.id) && m.enabled);
    setConfirmDialog({
      title: t('app.uninstallTitle', 'Uninstall {modName}', { modName: mod.name }),
      message: dependents.length > 0
        ? t('app.uninstallDependentMessage', 'This mod is required by {dependents}. Uninstalling may break these mods. Continue?', { dependents: dependents.map(d => d.name).join(', ') })
        : t('app.uninstallConfirmMessage', 'Are you sure you want to uninstall "{modName}"? Files will be deleted.', { modName: mod.name }),
      danger: true,
      onConfirm: () => { setConfirmDialog(null); doUninstall(mod); },
    });
  };

  const handleInstall = async () => {
    const result = await window.api.installMod();
    if (result.success) {
      showToast(t('app.toast.installed', 'Installed: {list}', { list: result.installed.join(', ') }));
      if (result.mods) syncMods(result.mods); else refreshMods();
    } else if (result.error !== 'Cancelled') showToast(result.error, 'error');
  };

  const handleBackup = async () => {
    const result = await window.api.backupMods();
    if (result.success) showToast(t('app.toast.archiveSuccess', 'Backup complete'));
    else if (result.error) showToast(result.error, 'error');
  };

  const handleRestore = () => {
    setConfirmDialog({
      title: t('app.restoreTitle', 'Restore MOD backup'),
      message: t('app.restoreMessage', 'Restore will overwrite the current mods folder with backup files. Existing mods may be replaced. Continue?'),
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        const result = await window.api.restoreMods();
        if (result.success) {
          showToast(t('app.toast.restoreSuccess', 'Restore complete'));
          if (result.mods) syncMods(result.mods); else refreshMods();
        } else if (result.error) showToast(result.error, 'error');
      },
    });
  };

  // Multi-select batch operations
  const handleBatchToggle = async (enable) => {
    const targets = mods.filter(m => selectedIds.has(m.instanceKey) && m.enabled !== enable);
    for (const mod of targets) {
      await window.api.toggleMod(mod);
    }
    setSelectedIds(new Set());
    refreshMods();
    showToast(t('app.batchToggleAction', 'Batch {action} {count} mods', { action: enable ? t('app.enable', 'Enable') : t('app.disable', 'Disable'), count: targets.length }));
  };

  const handleBatchUninstall = () => {
    const targets = mods.filter(m => selectedIds.has(m.instanceKey));
    if (targets.length === 0) return;
    setConfirmDialog({
      title: t('app.batchUninstallTitle', 'Batch uninstall {count} mods', { count: targets.length }),
      message: t('app.batchUninstallMessage', 'About to uninstall: {mods}. Files will be permanently deleted. Continue?', { mods: targets.map(m => m.name).join(', ') }),
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        for (const mod of targets) { await window.api.uninstallMod(mod); }
        setSelectedIds(new Set());
        setSelectedMod(null);
        refreshMods();
        showToast(t('app.batchUninstallAction', 'Batch uninstalled {count} mods', { count: targets.length }));
      },
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMods.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMods.map(m => m.instanceKey)));
    }
  };

  // Profile operations
  const handleSaveProfile = async () => {
    const name = newProfileName.trim();
    if (!name) return;
    const snapshot = {};
    mods.forEach(m => { snapshot[m.id] = m.enabled; });
    const updated = { ...profiles, [name]: { snapshot, savedAt: new Date().toISOString() } };
    await window.api.saveProfiles(updated);
    setProfiles(updated);
    setNewProfileName('');
    showToast(t('app.toast.profileSaved', 'Profile "{name}" saved', { name }));
  };

  const handleApplyProfile = (name) => {
    const profile = profiles[name];
    if (!profile) return;
    const changes = mods.filter(m => {
      const target = profile.snapshot[m.id];
      return target !== undefined && target !== m.enabled;
    });
    setConfirmDialog({
      title: t('app.confirm.applyProfileTitle', 'Apply profile "{name}"', { name }),
      message: changes.length > 0
        ? t('app.confirm.applyProfileMessage', 'This will change the enabled state of {count} mods and override the current game state. Apply?', { count: changes.length })
        : t('app.confirm.applyProfileNoChanges', 'Current mod state already matches this profile, no changes needed.'),
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        for (const mod of mods) {
          const shouldBeEnabled = profile.snapshot[mod.id];
          if (shouldBeEnabled !== undefined && shouldBeEnabled !== mod.enabled) {
            await window.api.toggleMod(mod);
          }
        }
        refreshMods();
        setShowProfiles(false);
        showToast(t('app.toast.profileApplied', 'Profile "{name}" applied', { name }));
      },
    });
  };

  const handleDeleteProfile = async (name) => {
    const updated = { ...profiles };
    delete updated[name];
    await window.api.saveProfiles(updated);
    setProfiles(updated);
    showToast(t('app.toast.profileDeleted', 'Profile "{name}" deleted', { name }));
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const paths = Array.from(e.dataTransfer.files)
      .filter(f => f.name.endsWith('.zip') || !f.name.includes('.') || f.type === '')
      .map(f => f.path);
    if (paths.length === 0) {
      showToast(t('app.dropZipOrFolderError', 'Please drag in a .zip archive or a mod folder'), 'error');
      return;
    }
    const result = await window.api.installDrop(paths);
    if (result.success) {
      showToast(t('app.toast.installedMods', 'Installed: {mods}', { mods: result.installed.join(', ') }));
      if (result.mods) syncMods(result.mods); else refreshMods();
    } else showToast(result.error, 'error');
  };

  const hasMissingDeps = (mod) => {
    if (!mod.dependencies || mod.dependencies.length === 0) return false;
    const enabledIds = mods.filter(m => m.enabled).map(m => m.id);
    return mod.dependencies.some(dep => !enabledIds.includes(dep));
  };

  const isFramework = (mod) => mods.some(m => m.id !== mod.id && m.dependencies && m.dependencies.includes(mod.id));

  const filteredMods = mods.filter(m => {
    if (filter === 'enabled' && !m.enabled) return false;
    if (filter === 'disabled' && m.enabled) return false;
    if (search) {
      const s = search.toLowerCase();
      return (m.name || '').toLowerCase().includes(s)
        || (m.id || '').toLowerCase().includes(s)
        || (m.author || '').toLowerCase().includes(s);
    }
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name': return (a.name || '').localeCompare(b.name || '');
      case 'depIssues': {
        const aIssue = hasMissingDeps(a) ? 0 : 1;
        const bIssue = hasMissingDeps(b) ? 0 : 1;
        return aIssue - bIssue || (a.name || '').localeCompare(b.name || '');
      }
      case 'gameplay': {
        const aScore = (a.affects_gameplay || a.has_dll) ? 0 : 1;
        const bScore = (b.affects_gameplay || b.has_dll) ? 0 : 1;
        return aScore - bScore || (a.name || '').localeCompare(b.name || '');
      }
      case 'category': {
        const catOrder = (m) => isFramework(m) ? 0 : (m.affects_gameplay || m.has_dll) ? 1 : 2;
        return catOrder(a) - catOrder(b) || (a.name || '').localeCompare(b.name || '');
      }
      case 'size': return (b.size || 0) - (a.size || 0);
      default: return 0;
    }
  });

  const enabledCount = mods.filter(m => m.enabled).length;
  const disabledCount = mods.filter(m => !m.enabled).length;

  return (
    <div className="h-screen flex flex-col bg-white text-gray-900">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          page={page}
          setPage={setPage}
          gamePath={gamePath}
          onSelectGamePath={handleSelectGamePath}
          enabledCount={enabledCount}
          totalCount={mods.length}
          gameVersion={gameVersion}
        />

        <main
          className={`flex-1 flex flex-col overflow-hidden transition-colors ${dragOver ? 'bg-blue-50' : 'bg-gray-50'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {page === 'mods' && (
            <>
              {/* Shared header for both views */}
              <div className="px-8 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-bold">{t('app.modManagement', 'MOD Management')}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('app.modSummary', '{total} mods · {enabled} enabled · {disabled} disabled', { total: mods.length, enabled: enabledCount, disabled: disabledCount })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleInstall}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                      <Download size={16} /> {t('app.installMod', 'Install MOD')}
                    </button>
                    <button onClick={refreshMods}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
                      <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {t('app.refresh', 'Refresh')}
                    </button>
                    {/* Profiles dropdown */}
                    <div className="relative">
                      <button onClick={() => setShowProfiles(!showProfiles)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
                        <Layers size={16} /> {t('app.profiles', 'Profiles')} <ChevronDown size={12} />
                      </button>
                      {showProfiles && (
                        <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                          <div className="p-3 border-b border-gray-50">
                            <div className="flex gap-1.5">
                              <input type="text" value={newProfileName} onChange={e => setNewProfileName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveProfile()}
                                placeholder={t('app.profileNamePlaceholder', 'Enter profile name...')}
                                className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-gray-300" />
                              <button onClick={handleSaveProfile}
                                className="px-2.5 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800">
                                <Save size={12} />
                              </button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1.5">{t('app.currentEnabledMods', '{count} mods enabled', { count: enabledCount })}</p>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {Object.keys(profiles).length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-4">{t('app.noConfig', 'No profiles')}</p>
                            ) : Object.entries(profiles).map(([name, profile]) => (
                              <div key={name} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 group">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium truncate">{name}</p>
                                  <p className="text-[10px] text-gray-400">
                                    {t('app.modCount', '{count} mods', { count: Object.values(profile.snapshot).filter(Boolean).length })}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleApplyProfile(name)}
                                    className="px-2 py-1 text-[10px] font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800">
                                    {t('app.apply', 'Apply')}
                                  </button>
                                  <button onClick={() => handleDeleteProfile(name)}
                                    className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={handleLaunchGame}
                      disabled={gameState !== 'idle'}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        gameState === 'idle'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : gameState === 'launching'
                            ? 'bg-amber-500 text-white cursor-wait'
                            : 'bg-blue-500 text-white cursor-default'
                      }`}>
                      {gameState === 'idle' && <><Play size={14} /> {t('app.launchGame', 'Launch game')}</>}
                      {gameState === 'launching' && <><Loader size={14} className="animate-spin" /> {t('app.launching', 'Launching...')}</>}
                      {gameState === 'running' && <><span className="w-2 h-2 rounded-full bg-white animate-pulse" /> {t('app.gameRunning', 'Game running')}</>}
                    </button>
                  </div>
                </div>

                {/* Search & filter & view toggle */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('app.searchPlaceholder', 'Search mods by name or author...')}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
                  </div>
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {[['all', t('app.filter.all', 'All')], ['enabled', t('app.filter.enabled', 'Enabled')], ['disabled', t('app.filter.disabled', 'Disabled')]].map(([key, label]) => (
                      <button key={key} onClick={() => setFilter(key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* Sort dropdown */}
                  <div className="relative">
                    <button onClick={() => setShowSortMenu(!showSortMenu)}
                      className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 bg-gray-100 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors">
                      <ArrowUpDown size={13} className="text-gray-400" />
                      {t(`app.sort.${sortBy}`, {
                        name: t('app.sort.name', 'Name'),
                        depIssues: t('app.sort.depIssues', 'Dependency issues'),
                        gameplay: t('app.sort.gameplay', 'Gameplay impact'),
                        category: t('app.sort.category', 'Category'),
                        size: t('app.sort.size', 'Size'),
                      }[sortBy])}
                      <ChevronDown size={11} className="text-gray-400" />
                    </button>
                    {showSortMenu && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden py-1">
                        {[['name', t('app.sort.nameOption', 'By name')], ['depIssues', t('app.sort.depIssuesOption', 'Dependency issues first')], ['gameplay', t('app.sort.gameplayOption', 'Gameplay impact first')], ['category', t('app.sort.categoryOption', 'By category')], ['size', t('app.sort.sizeOption', 'By size')]].map(([key, label]) => (
                          <button key={key}
                            onClick={() => { setSortBy(key); setShowSortMenu(false); }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                              sortBy === key ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-50'
                            }`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* View toggle */}
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                      title={t('app.view.grid', 'Grid view')}>
                      <LayoutGrid size={16} />
                    </button>
                    <button onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                      title={t('app.view.list', 'List view')}>
                      <List size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick actions + batch bar */}
              <div className="px-8 pb-3 flex items-center gap-2">
                {viewMode === 'list' && (
                  <input type="checkbox"
                    checked={filteredMods.length > 0 && selectedIds.size === filteredMods.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400 cursor-pointer mr-1" />
                )}
                <button onClick={() => window.api.openModsDir()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                  <FolderOpen size={14} /> {t('app.modFolder', 'MOD Folder')}
                </button>
                <button onClick={() => window.api.openGameDir()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                  <FolderOpen size={14} /> {t('app.gameDir', 'Game Folder')}
                </button>
                <button onClick={handleBackup}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                  <Archive size={14} /> {t('app.backup', 'Backup')}
                </button>
                <button onClick={handleRestore}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                  <UploadCloud size={14} /> {t('app.restore', 'Restore')}
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <span className="text-xs font-medium text-blue-600">{t('app.selectedCount', '{count} selected', { count: selectedIds.size })}</span>
                    <button onClick={() => handleBatchToggle(true)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100">
                      <ToggleRight size={12} /> {t('app.enable', 'Enable')}
                    </button>
                    <button onClick={() => handleBatchToggle(false)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">
                      <ToggleLeft size={12} /> {t('app.disable', 'Disable')}
                    </button>
                    <button onClick={handleBatchUninstall}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100">
                      <Trash2 size={12} /> {t('app.uninstall', 'Uninstall')}
                    </button>
                    <button onClick={() => setSelectedIds(new Set())}
                      className="p-1 text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>

              {/* Content area */}
              {viewMode === 'grid' ? (
                /* ===== GRID VIEW (default, original card layout) ===== */
                <div className="flex flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-8 pb-6">
                    {!gamePath ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">{t('app.welcome', 'Welcome to STS2 Mod Manager')}</h2>
                        <p className="text-sm text-gray-400 mb-8">{t('app.getStarted', 'Follow these steps to start managing your mods')}</p>
                        <div className="flex gap-5 max-w-2xl">
                          <div onClick={handleSelectGamePath}
                            className="flex-1 bg-white rounded-xl border-2 border-dashed border-gray-200 p-6 text-center cursor-pointer hover:border-gray-900 hover:shadow-lg transition-all group">
                            <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                              <FolderOpen size={22} />
                            </div>
                            <p className="font-semibold text-gray-800 mb-1">{t('app.steps.chooseGameDir.title', '1. Select game directory')}</p>
                            <p className="text-xs text-gray-400">{t('app.steps.chooseGameDir.detail', 'Locate your Slay the Spire 2 installation')}</p>
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-gray-100 p-6 text-center opacity-50">
                            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                              <Download size={22} />
                            </div>
                            <p className="font-semibold text-gray-500 mb-1">{t('app.steps.installFirstMod.title', '2. Install your first mod')}</p>
                            <p className="text-xs text-gray-400">{t('app.steps.installFirstMod.detail', 'Drag in a ZIP file or click the install button')}</p>
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-gray-100 p-6 text-center opacity-50">
                            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                              <Rocket size={22} />
                            </div>
                            <p className="font-semibold text-gray-500 mb-1">{t('app.steps.launchVerify.title', '3. Launch and verify')}</p>
                            <p className="text-xs text-gray-400">{t('app.steps.launchVerify.detail', 'Launch the game to confirm mods load correctly')}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-300 mt-6">{t('app.troubleshooting', 'Having issues? Check Game Logs in the sidebar for crash analysis')}</p>
                      </div>
                    ) : gamePath && mods.length === 0 && !search ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">{t('app.gameDetected', 'Game detected')}</h2>
                        <p className="text-sm text-gray-400 mb-8">{t('app.nextInstallFirstMod', 'Now install your first mod')}</p>
                        <div className="flex gap-5 max-w-2xl">
                          <div className="flex-1 bg-white rounded-xl border border-gray-100 p-6 text-center opacity-50">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                              <CheckCircle2 size={22} />
                            </div>
                            <p className="font-semibold text-gray-500 mb-1">{t('app.steps.chooseGameDir.title', '1. Select game directory')} ✓</p>
                            <p className="text-xs text-gray-400">{t('app.complete', 'Completed')}</p>
                          </div>
                          <div onClick={handleInstall}
                            className="flex-1 bg-white rounded-xl border-2 border-dashed border-gray-200 p-6 text-center cursor-pointer hover:border-gray-900 hover:shadow-lg transition-all group">
                            <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                              <Download size={22} />
                            </div>
                            <p className="font-semibold text-gray-800 mb-1">{t('app.steps.installFirstMod.title', '2. Install your first mod')}</p>
                            <p className="text-xs text-gray-400">{t('app.installFirstModHint', 'Drag a ZIP file here or click to select')}</p>
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-gray-100 p-6 text-center opacity-50">
                            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                              <Rocket size={22} />
                            </div>
                            <p className="font-semibold text-gray-500 mb-1">{t('app.steps.launchVerify.title', '3. Launch and verify')}</p>
                            <p className="text-xs text-gray-400">{t('app.steps.launchVerify.detail', 'Launch the game to confirm mods load correctly')}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-300 mt-6">{t('app.launchVerifyHint', 'Supports .zip format and drag-and-drop anywhere in the window')}</p>
                      </div>
                    ) : filteredMods.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <p className="text-lg font-medium">{search ? t('app.notFoundMods', 'No matching mods found') : t('app.noMods', 'No mods yet')}</p>
                        <p className="text-sm mt-1">{t('app.dragZipInstall', 'Drag ZIP files here to install')}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredMods.map(mod => (
                          <ModCard
                            key={mod.instanceKey || `${mod.id}-${mod.enabled}-${mod.folderName}`}
                            mod={mod}
                            allMods={mods}
                            translations={translations}
                            onToggle={() => handleToggle(mod)}
                            onClick={() => setSelectedMod(mod)}
                            selected={selectedMod?.instanceKey === mod.instanceKey}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Detail panel (slide-in) */}
                  {selectedMod && (
                    <ModDetail
                      mod={selectedMod}
                      allMods={mods}
                      onClose={() => setSelectedMod(null)}
                      onToggle={() => handleToggle(selectedMod)}
                      onUninstall={() => handleUninstall(selectedMod)}
                      onSelectMod={setSelectedMod}
                      onTranslationSaved={() => window.api.loadTranslations && window.api.loadTranslations().then(setTranslations)}
                    />
                  )}
                </div>
              ) : (
                /* ===== LIST VIEW (dual-pane with multi-select) ===== */
                <div className="flex flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto border-t border-gray-100">
                    {!gamePath ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <FolderOpen size={40} className="mb-3" />
                        <p className="text-sm font-medium mb-2">{t('app.noGamePath', 'Game path not detected')}</p>
                        <button onClick={handleSelectGamePath}
                          className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs">{t('app.chooseGameDirButton', 'Select game directory')}</button>
                      </div>
                    ) : filteredMods.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <p className="text-sm font-medium">{search ? t('app.notFoundMods', 'No matching mods found') : t('app.noMods', 'No mods yet')}</p>
                        <p className="text-xs mt-1">{t('app.dragZipInstall', 'Drag ZIP files here to install')}</p>
                      </div>
                    ) : (
                      filteredMods.map(mod => (
                        <ModListItem
                          key={mod.instanceKey || `${mod.id}-${mod.enabled}-${mod.folderName}`}
                          mod={mod}
                          allMods={mods}
                          translations={translations}
                          selected={selectedMod?.instanceKey === mod.instanceKey}
                          multiSelected={selectedIds.has(mod.instanceKey)}
                          onToggle={() => handleToggle(mod)}
                          onClick={() => setSelectedMod(mod)}
                          onCheckToggle={() => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(mod.instanceKey)) next.delete(mod.instanceKey);
                              else next.add(mod.instanceKey);
                              return next;
                            });
                          }}
                          draggable={false}
                        />
                      ))
                    )}
                  </div>
                  {/* Right: Detail panel (always visible) */}
                  {selectedMod ? (
                    <ModDetail
                      mod={selectedMod}
                      allMods={mods}
                      onClose={() => setSelectedMod(null)}
                      onToggle={() => handleToggle(selectedMod)}
                      onUninstall={() => handleUninstall(selectedMod)}
                      onSelectMod={setSelectedMod}
                      onTranslationSaved={() => window.api.loadTranslations && window.api.loadTranslations().then(setTranslations)}
                    />
                  ) : (
                    <div className="w-80 bg-white border-l border-gray-100 flex flex-col items-center justify-center text-gray-300">
                      <Package size={40} className="mb-3" />
                      <p className="text-sm">{t('app.selectModDetail', 'Select a mod to view details')}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {page === 'saves' && <SaveManager />}
          {page === 'logs' && <LogViewer />}
        </main>
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 bg-blue-50/80 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
            <Download size={40} className="mx-auto mb-3 text-gray-900" />
            <p className="text-lg font-semibold">{t('app.dragInstallPrompt', 'Drop ZIP files to install mods')}</p>
          </div>
        </div>
      )}

      {/* Close dropdowns when clicking elsewhere */}
      {showProfiles && (
        <div className="fixed inset-0 z-40" onClick={() => setShowProfiles(false)} />
      )}
      {showSortMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
      )}

      {/* Crash Analysis Dialog */}
      {crashReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setCrashReport(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{t('app.crashReport.title', 'Crash analysis')}</h3>
                  <p className="text-xs text-gray-400">{crashReport.logFile}</p>
                </div>
              </div>
              <button onClick={() => setCrashReport(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh] space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 bg-red-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-red-600">{crashReport.errorCount}</p>
                  <p className="text-[10px] text-red-400 uppercase font-semibold">{t('app.crashReport.errors', 'Errors')}</p>
                </div>
                <div className="flex-1 bg-amber-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-amber-600">{crashReport.warnCount}</p>
                  <p className="text-[10px] text-amber-400 uppercase font-semibold">{t('app.crashReport.warnings', 'Warnings')}</p>
                </div>
              </div>
              {crashReport.issues.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase">{t('app.crashReport.issuesDetected', 'Detected issues')}</p>
                  {crashReport.issues.map((issue, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} className="text-amber-500" />
                        <span className="text-sm font-semibold text-gray-800">{issue.reason}</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed pl-[22px]">{issue.detail}</p>
                      {issue.mods && issue.mods.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 pl-[22px]">
                          {issue.mods.map(m => (
                            <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{m}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <Info size={20} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">{t('app.crashReport.noCause', 'No clear crash cause detected')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('app.crashReport.noCauseHint', 'It may be a normal exit, or check the full log for more details')}</p>
                </div>
              )}
              {crashReport.involvedMods && crashReport.involvedMods.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase">{t('app.crashReport.involvedMods', 'Involved mods')}</p>
                  {crashReport.involvedMods.map((mod, i) => (
                    <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg px-4 py-3">
                      <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-red-500">{mod.errorCount}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{mod.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{mod.sample}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {crashReport.notices && crashReport.notices.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{t('app.crashReport.harmlessNotices', 'Harmless notices (can be ignored)')}</p>
                  <div className="bg-blue-50 rounded-lg px-4 py-3 space-y-1">
                    {crashReport.notices.map((n, i) => (
                      <p key={i} className="text-[11px] text-blue-600">{n}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => { setCrashReport(null); setPage('logs'); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                {t('app.crashReport.viewFullLogs', 'View full logs')}
              </button>
              <button onClick={() => setCrashReport(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                {t('app.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmDialog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmDialog.danger ? 'bg-red-50' : 'bg-blue-50'}`}>
                <AlertTriangle size={20} className={confirmDialog.danger ? 'text-red-500' : 'text-blue-500'} />
              </div>
              <h3 className="font-bold text-gray-900">{confirmDialog.title}</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={confirmDialog.onConfirm}
                style={{ backgroundColor: confirmDialog.danger ? '#dc2626' : '#111827', color: '#fff' }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors">
                {t('app.confirm', 'Confirm')}
              </button>
              <button onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                {t('app.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 transition-all ${
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
