import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { Plus, Trash2, Upload, Save, Layers } from 'lucide-react';

export default function ProfileManager({ mods, onRefresh }) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState({});
  const [newName, setNewName] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    window.api.loadProfiles().then(setProfiles);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleSave = async () => {
    const name = newName.trim();
    if (!name) return;

    const snapshot = {};
    mods.forEach(m => { snapshot[m.id] = m.enabled; });

    const updated = { ...profiles, [name]: { snapshot, savedAt: new Date().toISOString() } };
    await window.api.saveProfiles(updated);
    setProfiles(updated);
    setNewName('');
    showToast(t('profileManager.toast.saved', 'Profile "{name}" saved', { name }));
  };

  const handleApply = async (name) => {
    const profile = profiles[name];
    if (!profile) return;

    // Toggle mods to match profile
    for (const mod of mods) {
      const shouldBeEnabled = profile.snapshot[mod.id];
      if (shouldBeEnabled !== undefined && shouldBeEnabled !== mod.enabled) {
        await window.api.toggleMod(mod);
      }
    }
    onRefresh();
    showToast(t('profileManager.toast.applied', 'Profile "{name}" applied', { name }));
  };

  const handleDelete = async (name) => {
    const updated = { ...profiles };
    delete updated[name];
    await window.api.saveProfiles(updated);
    setProfiles(updated);
    showToast(t('profileManager.toast.deleted', 'Profile "{name}" deleted', { name }));
  };

  const profileNames = Object.keys(profiles);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-8 pt-6 pb-4">
        <h1 className="text-2xl font-bold mb-1">{t('profileManager.title', 'Profiles')}</h1>
        <p className="text-sm text-gray-500">{t('profileManager.subtitle', 'Save and switch different MOD enable combinations')}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6">
        {/* Create new profile */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Plus size={16} /> {t('profileManager.saveCurrentProfile', 'Save current profile')}
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={t('profileManager.profileNamePlaceholder', 'Enter a profile name (e.g. "Online", "All mods")')}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            <button onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
              <Save size={16} /> {t('profileManager.save', 'Save')}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {t('profileManager.currentlyEnabled', 'Currently {count} mods enabled:', { count: mods.filter(m => m.enabled).length })}
            {mods.filter(m => m.enabled).map(m => m.name).join(', ') || t('profileManager.none', 'None')}
          </p>
        </div>

        {/* Profile list */}
        {profileNames.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Layers size={40} className="mx-auto mb-3" />
            <p className="font-medium">{t('profileManager.noProfiles', 'No profiles yet')}</p>
            <p className="text-sm mt-1">{t('profileManager.saveProfileHint', 'Save the current mod set as a profile')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profileNames.map(name => {
              const profile = profiles[name];
              const enabledMods = Object.entries(profile.snapshot).filter(([, v]) => v).map(([k]) => k);
              const savedDate = new Date(profile.savedAt).toLocaleString('zh-CN');

              return (
                <div key={name} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-sm">{name}</h4>
                      <p className="text-xs text-gray-400">{savedDate} · {t('profileManager.enabledModsCount', '{count} mods', { count: enabledMods.length })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleApply(name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors">
                        <Upload size={12} /> {t('profileManager.apply', 'Apply')}
                      </button>
                      <button onClick={() => handleDelete(name)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {enabledMods.map(id => (
                      <span key={id} className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md text-[11px]">
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
