import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { Download, Upload, RefreshCw, Trash2, HardDrive, Gamepad2, FolderOpen, Clock, Trophy, Sword, Layers, CreditCard } from 'lucide-react';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatPlaytime(seconds, t) {
  if (!seconds) return t('saveManager.duration.zero', '0 minutes');
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return t('saveManager.duration.hoursMinutes', '{hours} hours {minutes} minutes', { hours: h, minutes: m });
  return t('saveManager.duration.minutes', '{minutes} minutes', { minutes: m });
}

const SLOT_LABELS = { profile1: 'saveManager.slot1', profile2: 'saveManager.slot2', profile3: 'saveManager.slot3' };

function SaveSummary({ summary, accent }) {
  const { t } = useTranslation();
  if (!summary) return null;
  const accentColor = accent === 'purple' ? 'purple' : 'emerald';
  return (
    <div className="space-y-3 mb-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
            <Clock size={11} /><span className="text-[10px] uppercase font-semibold">{t('saveManager.stats.playtime', 'Playtime')}</span>
          </div>
          <p className="text-xs font-medium text-gray-700">{formatPlaytime(summary.totalPlaytime, t)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
            <Trophy size={11} /><span className="text-[10px] uppercase font-semibold">{t('saveManager.stats.score', 'Score')}</span>
          </div>
          <p className="text-xs font-medium text-gray-700">{summary.currentScore.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
            <Layers size={11} /><span className="text-[10px] uppercase font-semibold">{t('saveManager.stats.floors', 'Floors climbed')}</span>
          </div>
          <p className="text-xs font-medium text-gray-700">{summary.floorsClimbed}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
            <CreditCard size={11} /><span className="text-[10px] uppercase font-semibold">{t('saveManager.stats.discovery', 'Discovery')}</span>
          </div>
          <p className="text-xs font-medium text-gray-700">{t('saveManager.stats.discoveryCount', '{cards} cards / {relics} relics', { cards: summary.discoveredCards, relics: summary.discoveredRelics })}</p>
        </div>
      </div>

      {/* Characters */}
      {summary.characters.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">{t('saveManager.stats.characterRecord', 'Character record')}</p>
          <div className="space-y-1">
            {summary.characters.map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs px-2 py-1 bg-gray-50 rounded-md">
                <span className="font-medium text-gray-700">{t('characters.' + c.id, c.id.split('.')[1] || c.id)}</span>
                <span className="text-gray-500">
                  <span className={`text-${accentColor}-600 font-medium`}>{t('saveManager.stats.wins', '{count} W', { count: c.wins })}</span>
                  <span className="mx-1">/</span>
                  <span className="text-red-400">{t('saveManager.stats.losses', '{count} L', { count: c.losses })}</span>
                  {c.maxAscension > 0 && <span className="ml-1.5 text-amber-500">A{c.maxAscension}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Runs */}
      {summary.epochs > 0 && (
        <p className="text-[10px] text-gray-400">{t('saveManager.stats.epochs', 'Completed {count} runs', { count: summary.epochs })}</p>
      )}
    </div>
  );
}

function SlotCard({ slotName, slot, modded, onExport, onImport }) {
  const { t } = useTranslation();
  const isEmpty = !slot || slot.empty;
  const accent = modded ? 'purple' : 'emerald';
  const borderClass = isEmpty ? 'border-gray-100' : modded ? 'border-purple-200 shadow-sm' : 'border-gray-200 shadow-sm';

  return (
    <div className={`bg-white rounded-xl border p-5 transition-colors ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">
          {t(SLOT_LABELS[slotName], slotName === 'profile1' ? 'Save 1' : slotName === 'profile2' ? 'Save 2' : 'Save 3')}
          {modded && <span className="text-xs text-purple-500 font-normal ml-1.5">MOD</span>}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          isEmpty ? 'bg-gray-100 text-gray-400'
            : modded ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'
        }`}>
          {isEmpty ? t('saveManager.slot.empty', 'Empty') : t('saveManager.slot.hasData', 'Has data')}
        </span>
      </div>

      {!isEmpty && slot.summary && (
        <SaveSummary summary={slot.summary} accent={accent} />
      )}

      {!isEmpty && !slot.summary && (
        <div className="text-xs text-gray-500 space-y-1 mb-4">
          <p>{t('saveManager.slot.sizeLabel', 'Size')}: {formatSize(slot.size)}</p>
          <p>{t('saveManager.slot.lastModifiedLabel', 'Last modified')}: {formatTime(slot.lastModified)}</p>
        </div>
      )}

      {isEmpty && <p className="text-xs text-gray-400 mb-4">{t('saveManager.slot.noData', 'No save data available')}</p>}

      {!isEmpty && (
        <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-3">
          <span>{formatSize(slot.size)}</span>
          <span>·</span>
          <span>{formatTime(slot.lastModified)}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => onExport(slotName, modded)}
          disabled={isEmpty}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            isEmpty
              ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
              : modded ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}>
          <Download size={13} /> {t('saveManager.export', 'Export')}
        </button>
        <button onClick={() => onImport(slotName, modded)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
          <Upload size={13} /> {t('saveManager.import', 'Import')}
        </button>
      </div>
    </div>
  );
}

export default function SaveManager() {
  const { t } = useTranslation();
  const [data, setData] = useState({ slots: [], backups: [] });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const refresh = async () => {
    setLoading(true);
    const result = await window.api.scanSaves();
    setData(result);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleExport = async (slot, modded) => {
    const result = await window.api.exportSave({ slot, modded });
    if (result.success) {
      showToast(t('saveManager.toast.exportSuccess', 'Save export successful'));
      refresh();
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  };

  const handleImport = async (slot, modded) => {
    const result = await window.api.importSave({ slot, modded });
    if (result.success) {
      showToast(t('saveManager.toast.importSuccess', 'Save import successful (original save auto-backed up)'));
      refresh();
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  };

  const handleDeleteBackup = async (backupPath) => {
    const result = await window.api.deleteBackup(backupPath);
    if (result.success) {
      showToast(t('saveManager.toast.backupDeleted', 'Backup deleted'));
      refresh();
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  };

  const normalSlots = data.slots.filter(s => !s.modded);
  const moddedSlots = data.slots.filter(s => s.modded);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">{t('saveManager.title', 'Save Manager')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('saveManager.subtitle', 'Export, import and backup your game saves')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {t('saveManager.refresh', 'Refresh')}
            </button>
            <button onClick={() => window.api.openSavesDir()}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
              <FolderOpen size={16} /> {t('saveManager.openFolder', 'Open folder')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6 space-y-6">
        {/* Normal saves */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <HardDrive size={14} /> {t('saveManager.normalSaves', 'Normal saves')}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {['profile1', 'profile2', 'profile3'].map(slotName => (
              <SlotCard key={slotName}
                slotName={slotName}
                slot={normalSlots.find(s => s.slot === slotName)}
                modded={false}
                onExport={handleExport}
                onImport={handleImport}
              />
            ))}
          </div>
        </section>

        {/* Modded saves */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Gamepad2 size={14} /> {t('saveManager.moddedSaves', 'MOD saves')}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {['profile1', 'profile2', 'profile3'].map(slotName => (
              <SlotCard key={slotName}
                slotName={slotName}
                slot={moddedSlots.find(s => s.slot === slotName)}
                modded={true}
                onExport={handleExport}
                onImport={handleImport}
              />
            ))}
          </div>
        </section>

        {/* Backups */}
        {data.backups.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {t('saveManager.backupRecords', 'Auto backup records')}
            </h2>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {data.backups.map(b => (
                <div key={b.name} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{b.name}</p>
                    <p className="text-xs text-gray-400">{formatTime(b.time)} · {formatSize(b.size)}</p>
                  </div>
                  <button onClick={() => handleDeleteBackup(b.path)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title={t('saveManager.deleteBackup', 'Delete backup')}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.slots.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <HardDrive size={48} className="mb-4" />
            <p className="text-lg font-medium">{t('saveManager.noSaves', 'No game saves detected')}</p>
            <p className="text-sm mt-1">{t('saveManager.noSavesHint', 'Run the game once to create the save directory')}</p>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
